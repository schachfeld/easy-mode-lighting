//! Keeps the Home Assistant connection in the operating system's secure
//! storage, so Glow can reconnect without signing in again.
//!
//! - iOS: the Keychain, readable after the first unlock and never synced or
//!   restored to another device.
//! - Android: app preferences encrypted with a non-exportable Android Keystore
//!   key. A backup restored elsewhere cannot be decrypted.
//!
//! Other platforms report that secure storage is unavailable, and the
//! interface falls back to the passphrase-protected Stronghold vault.

#[cfg(any(target_os = "android", target_os = "ios"))]
mod platform {
    use keyring_core::{Entry, Error, Result};

    const SERVICE: &str = "io.github.schachfeld.glow";
    const ACCOUNT: &str = "home-assistant-connection";

    #[cfg(target_os = "android")]
    fn entry() -> Result<Entry> {
        use keyring_core::api::CredentialStoreApi;
        android_native_keyring_store::Store::new()?.build(SERVICE, ACCOUNT, None)
    }

    #[cfg(target_os = "ios")]
    fn entry() -> Result<Entry> {
        use apple_native_keyring_store::protected::{AccessPolicy, Cred};
        Cred::build(
            SERVICE,
            ACCOUNT,
            AccessPolicy::AfterFirstUnlockThisDeviceOnly,
            None,
            false,
        )
    }

    pub fn load() -> Result<Option<String>> {
        match entry()?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(Error::NoEntry) => Ok(None),
            Err(error) => Err(error),
        }
    }

    pub fn save(value: &str) -> Result<()> {
        entry()?.set_password(value)
    }

    pub fn forget() -> Result<()> {
        match entry()?.delete_credential() {
            Ok(()) | Err(Error::NoEntry) => Ok(()),
            Err(error) => Err(error),
        }
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod platform {
    pub fn load() -> Result<Option<String>, &'static str> {
        Ok(None)
    }

    pub fn save(_: &str) -> Result<(), &'static str> {
        Err("This device has no secure storage for your sign-in.")
    }

    pub fn forget() -> Result<(), &'static str> {
        Ok(())
    }
}

// Keychain and Keystore calls can block, so keep them off the main thread.
async fn blocking<T: Send + 'static, E: ToString + Send + 'static>(
    task: impl FnOnce() -> Result<T, E> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn secure_storage_available() -> bool {
    cfg!(any(target_os = "android", target_os = "ios"))
}

#[tauri::command]
pub async fn load_secure_connection() -> Result<Option<String>, String> {
    blocking(platform::load).await
}

#[tauri::command]
pub async fn save_secure_connection(connection: String) -> Result<(), String> {
    if connection.is_empty() || connection.len() > 16 * 1024 {
        return Err("This connection cannot be saved.".into());
    }
    blocking(move || platform::save(&connection)).await
}

pub async fn forget_secure_connection() -> Result<(), String> {
    blocking(platform::forget).await
}
