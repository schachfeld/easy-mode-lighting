use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneRequest {
    url: String,
    method: String,
    token: String,
    body: Option<Value>,
    timeout_ms: u64,
}

#[derive(Serialize)]
pub struct SceneResponse {
    status: u16,
    body: Value,
}

fn scene_endpoint(input: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(input).map_err(|_| "Invalid Home Assistant address.")?;
    let scene_id = url
        .path()
        .rsplit_once("/api/config/scene/config/")
        .map(|(_, id)| id);
    if !["http", "https"].contains(&url.scheme())
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !scene_id.is_some_and(|id| {
            !id.is_empty()
                && id
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
        })
    {
        return Err("Invalid Home Assistant scene endpoint.".into());
    }
    Ok(url)
}

#[tauri::command]
pub async fn ha_scene_request(request: SceneRequest) -> Result<SceneResponse, String> {
    let endpoint = scene_endpoint(&request.url)?;
    let method = match request.method.as_str() {
        "POST" => reqwest::Method::POST,
        "DELETE" => reqwest::Method::DELETE,
        _ => return Err("Unsupported scene request.".into()),
    };
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_millis(request.timeout_ms.clamp(1000, 30000)))
        .build()
        .map_err(|_| "Could not initialize the Home Assistant connection.")?;
    let mut outgoing = client.request(method, endpoint).bearer_auth(request.token);
    if let Some(body) = request.body {
        outgoing = outgoing.json(&body);
    }
    let response = outgoing
        .send()
        .await
        .map_err(|_| "Could not reach Home Assistant.")?;
    let status = response.status().as_u16();
    let body = response.json().await.unwrap_or(Value::Null);
    Ok(SceneResponse { status, body })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_scene_endpoints_are_allowed_and_proxy_paths_are_preserved() {
        let url = "https://home.example/proxy/api/config/scene/config/glow_123-abc";
        assert_eq!(scene_endpoint(url).unwrap().as_str(), url);
        for url in [
            "file:///api/config/scene/config/glow_123",
            "https://user:secret@home/api/config/scene/config/glow_123",
            "https://home/api/config/scene/config/glow_123?token=secret",
            "https://home/api/config/scene/config/glow_123#fragment",
            "https://home/api/config/scene/config/",
            "https://home/api/config/scene/config/../other",
            "https://home/api/config/scene/config/foo%2fbar",
            "https://home/api/services/light/turn_on",
        ] {
            assert!(scene_endpoint(url).is_err(), "{url}");
        }
    }
}
