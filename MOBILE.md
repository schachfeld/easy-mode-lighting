# Glow mobile

Glow builds the Home Assistant add-on and a Tauri 2 app from the same React UI and lighting core. The mobile app connects directly to Home Assistant; it does not need the Glow add-on or a separate Node server.

## Run and build

Install dependencies with `npm ci`. Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your development machine and target platform first. Rust 1.90 or newer is required by the plugins. Android needs Android Studio, its SDK/NDK, and a JDK. iOS needs macOS and Xcode.

```sh
# Preview the connection screen in a browser (native connections are disabled)
npm run dev:mobile

# Build both frontends independently
npm run build
npm run build:mobile

# Optional desktop shell for native development
npm run tauri -- dev

# Initialize the generated Android project once, then run on a device/emulator
npm run tauri -- android init
npm run mobile:android

# Build an Android debug APK for an ARM64 device
npm run tauri -- android build --debug --apk --target aarch64

# On macOS: initialize iOS, then run on a device/simulator
npm run tauri -- ios init
npm run mobile:ios
```

The mobile dev server uses port 5181; the add-on dev server continues to use 5180. Tauri supplies `TAURI_DEV_HOST` for physical-device development. Android projects and Xcode projects are generated into `src-tauri/gen/` and are not committed. App icons and iOS local-network permission text are included. iOS requires version 16 or later; Android's minimum SDK is 24.

The **Mobile Android build** GitHub Actions workflow can produce a debug ARM64 APK from a manually selected branch. Debug artifacts are for testing. Store distribution still needs platform signing, developer accounts, and release configuration. The normal CI also compiles the Rust shell on Linux. Local browser tests mock native IPC; they do not replace device testing or prove that a native package builds.

## Connect

Enter your Home Assistant base address, for example `http://homeassistant.local:8123` or your reachable HTTPS address. Reverse-proxy prefixes are supported. Choose **Sign in with Home Assistant**. Glow opens your system browser, where you sign in on your own Home Assistant instance and approve access. The return link opens Glow again; choose **Open my home** to connect. Glow never asks for your Home Assistant password. **Use an access token instead** remains available for manually supplied long-lived access tokens. The account must be allowed to read the registries and control your lights.

By default credentials remain in memory for that session. Account login uses a renewable refresh token and obtains a fresh access token on reconnection. **Remember this connection** encrypts the refresh token (or manually supplied token) in a Tauri Stronghold snapshot using a user-selected passphrase and Argon2 derivation. Unlock it with that passphrase after reopening the app. The passphrase is not saved. **Disconnect** closes the connection; **Forget saved connection** removes the saved credentials without deleting scenes. Browser local storage is never used for production credentials.

The connection uses Tauri's native WebSocket transport, including normal certificate validation for HTTPS/WSS. Local HTTP/WS is supported; the native transport avoids WebView mixed-content restrictions. Do not disable certificate verification for a self-signed instance; use a trusted certificate or your local address. Away from home, the configured address must be reachable through your existing remote-access arrangement or VPN. Glow does not provide a relay.

The app reconnects after connection loss and when returning to the foreground. Revoked account access stops retries and asks you to sign in again. Disconnect, forget any saved connection, and sign in again. Existing saved manual-token connections continue to work. Lights remain under Home Assistant's control while Glow is closed; the app does not run background lighting automations.

## Publish the login identity page

The default client identity is `https://schachfeld.github.io/easy-mode-lighting/`. Home Assistant must be able to fetch this public HTTPS page to approve the custom return link `glow-lighting://auth/callback`. The page is static metadata; login codes and credentials return directly to the native app.

1. Publish the changes containing `auth-client/index.html` and `.github/workflows/auth-identity.yml` to GitHub.
2. In repository **Settings → Pages**, select **GitHub Actions** as the source.
3. Run the **Publish Glow login identity** workflow from the branch containing the page.
4. Verify the public URL responds successfully and its HTML contains `<link rel="redirect_uri" href="glow-lighting://auth/callback" />`.

Deployment is manual. Account login cannot complete while this URL returns 404. For a fork, host the same metadata page at your own HTTPS URL and set `VITE_HA_CLIENT_ID` to that URL when building the app. Keep the identity stable: saved refresh tokens are tied to it.

Tauri registers the custom URL scheme in native builds. Test browser return links on installed Android/iOS builds; an ordinary browser preview cannot receive native callbacks. Desktop development may require installing a packaged build to register the scheme. Pending login state expires after ten minutes and survives an app restart. Cancelled, expired, and mismatched callbacks cannot exchange a code. This login change does not affect add-on ingress authentication.

## Where scenes live

- The add-on keeps custom scenes and favorites in its existing `/data/scenes.json`, shared by browsers using that add-on.
- Mobile keeps custom scenes and favorites in its own app data, separated by normalized Home Assistant base URL. Changing to a different URL creates a separate scene library, even if both URLs reach the same instance.
- Existing Home Assistant scenes are discovered and activated by both versions. Edit those scenes in Home Assistant.

Custom Glow scenes are **not synchronized between the add-on and mobile**, and do not become Home Assistant scene entities. This preserves the existing add-on data and lets mobile operate independently. Scenes on a mobile device can be lost when its app data is cleared or the app is removed.

## Shared architecture

| Location                                                                     | Responsibility                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/App.tsx`, `src/SceneEditor.tsx`, `src/components.tsx`, `src/styles.css` | Shared React interface                                                         |
| `packages/core/model.mjs`                                                    | Room discovery, capability mapping, palettes, validation                       |
| `packages/core/controller.mjs`                                               | Light commands, scene lifecycle and application; injected storage              |
| `packages/core/home-assistant.mjs`                                           | Authentication, discovery, state events, heartbeat and reconnecting            |
| `packages/core/native-socket.mjs`                                            | Adapts asynchronous native sockets and buffers early authentication frames     |
| `src/platform/client.ts`                                                     | UI contract and add-on HTTP/event-stream adapter                               |
| `server/`                                                                    | Express, ingress, Node sockets and atomic file storage                         |
| `src/mobile/`                                                                | Direct connection adapter, onboarding, device persistence and credential vault |
| `src-tauri/`                                                                 | Native shell, capabilities and build configuration                             |

The shared core has no Node, React, or Tauri dependency. The add-on imports it directly; Vite bundles it into the mobile frontend. Platform entry points supply storage and socket implementations. Mobile dependencies are excluded from the add-on browser bundle. Add-on packaging includes `packages/` in both its source archive and runtime container.

## Checks

```sh
npm test
npm run build
npm run build:mobile
npm run test:browser
npm run format:check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
npm run package:addon
```

The tests cover the shared core through real WebSockets, delayed native socket opening, cancellation, authentication failures, reconnect discovery, asynchronous save failures, the mobile connection flow, light control, scene persistence and separation between homes. The browser suite also checks the existing add-on scene lifecycle and Home Assistant ingress paths.
