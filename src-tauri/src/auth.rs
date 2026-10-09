use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenRequest {
    base_url: String,
    client_id: String,
    grant_type: String,
    code: Option<String>,
    refresh_token: Option<String>,
}

#[derive(Deserialize, Serialize)]
pub struct TokenResponse {
    access_token: String,
    expires_in: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    refresh_token: Option<String>,
}

#[derive(Serialize)]
pub struct AuthError {
    message: String,
    reauthenticate: bool,
}

impl AuthError {
    fn new(message: &str, reauthenticate: bool) -> Self {
        Self {
            message: message.into(),
            reauthenticate,
        }
    }
}

fn token_endpoint(base: &str) -> Result<reqwest::Url, AuthError> {
    let mut url = reqwest::Url::parse(base)
        .map_err(|_| AuthError::new("Enter a valid Home Assistant address.", false))?;
    if !["http", "https"].contains(&url.scheme())
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(AuthError::new(
            "Use a Home Assistant HTTP or HTTPS address without embedded credentials.",
            false,
        ));
    }
    let path = format!("{}/auth/token", url.path().trim_end_matches('/'));
    url.set_path(&path);
    Ok(url)
}

#[tauri::command]
pub async fn ha_token_request(request: TokenRequest) -> Result<TokenResponse, AuthError> {
    let endpoint = token_endpoint(&request.base_url)?;
    let credential = match request.grant_type.as_str() {
        "authorization_code" => ("code", request.code),
        "refresh_token" => ("refresh_token", request.refresh_token),
        _ => return Err(AuthError::new("Unsupported sign-in request.", false)),
    };
    let credential_value = credential.1.filter(|s| !s.is_empty()).ok_or_else(|| {
        AuthError::new(
            "The sign-in credential is missing. Please sign in again.",
            true,
        )
    })?;
    let client = reqwest::Client::builder()
        // Never forward authorization codes or refresh tokens to a redirect.
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| AuthError::new("Could not initialize sign-in.", false))?;
    let response = client.post(endpoint).form(&[
        ("grant_type", request.grant_type.as_str()),
        ("client_id", request.client_id.as_str()),
        (credential.0, credential_value.as_str()),
    ]).send().await.map_err(|_| AuthError::new("Cannot reach Home Assistant to renew your sign-in. Check your connection and try again.", false))?;
    if [400, 401, 403].contains(&response.status().as_u16()) {
        return Err(AuthError::new(
            "Your Home Assistant sign-in is no longer valid. Please sign in again.",
            true,
        ));
    }
    if !response.status().is_success() {
        return Err(AuthError::new(
            "Home Assistant could not complete sign-in. Check your address and try again.",
            false,
        ));
    }
    let token: TokenResponse = response.json().await.map_err(|_| {
        AuthError::new(
            "Home Assistant returned an invalid sign-in response.",
            false,
        )
    })?;
    if token.access_token.is_empty() || token.expires_in == 0 || token.expires_in > 31_536_000 {
        return Err(AuthError::new(
            "Home Assistant returned an invalid access token.",
            false,
        ));
    }
    Ok(token)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(
        status: &str,
        body: &str,
        extra_headers: &str,
    ) -> (String, std::thread::JoinHandle<String>) {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        let response = format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n{extra_headers}Connection: close\r\n\r\n{body}", body.len());
        let thread = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            let mut buffer = [0_u8; 4096];
            loop {
                let count = stream.read(&mut buffer).unwrap();
                if count == 0 {
                    break;
                }
                bytes.extend_from_slice(&buffer[..count]);
                let text = String::from_utf8_lossy(&bytes);
                if let Some((headers, body)) = text.split_once("\r\n\r\n") {
                    let length = headers
                        .lines()
                        .find_map(|line| {
                            line.to_lowercase()
                                .strip_prefix("content-length: ")
                                .and_then(|v| v.parse::<usize>().ok())
                        })
                        .unwrap_or(0);
                    if body.len() >= length {
                        break;
                    }
                }
            }
            stream.write_all(response.as_bytes()).unwrap();
            String::from_utf8(bytes).unwrap()
        });
        (address, thread)
    }

    fn request(url: String, grant_type: &str) -> TokenRequest {
        TokenRequest {
            base_url: url,
            client_id: "https://glow.example/".into(),
            grant_type: grant_type.into(),
            code: Some("code&value".into()),
            refresh_token: Some("refresh&secret".into()),
        }
    }

    #[tokio::test]
    async fn code_and_refresh_exchanges_are_form_encoded_and_only_send_the_requested_credential() {
        for kind in ["authorization_code", "refresh_token"] {
            let (url, server) = fixture(
                "200 OK",
                r#"{"access_token":"short-lived","expires_in":1800,"refresh_token":"renewable"}"#,
                "",
            );
            let token = ha_token_request(request(url, kind)).await.ok().unwrap();
            assert_eq!(token.access_token, "short-lived");
            let raw = server.join().unwrap();
            assert!(raw.starts_with("POST /auth/token HTTP/1.1"));
            assert!(raw.contains("application/x-www-form-urlencoded"));
            assert!(raw.contains("client_id=https%3A%2F%2Fglow.example%2F"));
            if kind == "authorization_code" {
                assert!(raw.contains("code=code%26value"));
                assert!(!raw.contains("refresh%26secret"));
            } else {
                assert!(raw.contains("refresh_token=refresh%26secret"));
                assert!(!raw.contains("code%26value"));
            }
        }
    }

    #[tokio::test]
    async fn rejected_tokens_are_terminal_but_server_errors_and_redirects_are_not_followed() {
        for (status, terminal) in [
            ("400 Bad Request", true),
            ("403 Forbidden", true),
            ("503 Unavailable", false),
            ("307 Temporary Redirect", false),
        ] {
            let (url, server) = fixture(status, "{}", "Location: http://127.0.0.1:1/steal\r\n");
            let result = ha_token_request(request(url, "refresh_token")).await;
            assert!(result.is_err());
            assert_eq!(result.err().unwrap().reauthenticate, terminal);
            server.join().unwrap();
        }
    }

    #[test]
    fn endpoints_preserve_proxy_paths_and_reject_embedded_secrets() {
        assert_eq!(
            token_endpoint("https://home.example/ha/")
                .ok()
                .unwrap()
                .as_str(),
            "https://home.example/ha/auth/token"
        );
        for url in [
            "file:///tmp/ha",
            "https://user:pass@home",
            "https://home/?token=x",
            "https://home/#x",
        ] {
            assert!(token_endpoint(url).is_err());
        }
    }
}
