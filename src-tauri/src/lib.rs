use tauri::Manager;

#[tauri::command]
fn has_saved_connection(app: tauri::AppHandle) -> Result<bool, String> {
    let path = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    Ok(path.join("connection.hold").exists())
}

#[tauri::command]
fn forget_connection(app: tauri::AppHandle) -> Result<(), String> {
    let path = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    match std::fs::remove_file(path.join("connection.hold")) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let directory = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&directory.join("vault-salt"))
                    .build(),
            )?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            has_saved_connection,
            forget_connection
        ])
        .run(tauri::generate_context!())
        .expect("could not start Glow");
}
