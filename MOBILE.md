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

The **Mobile Android build** GitHub Actions workflow can produce a debug ARM64 APK from a manually selected branch. Debug artifacts are for testing. The **Mobile iOS TestFlight** workflow builds a signed App Store build and uploads it to TestFlight; see below. Google Play distribution still needs signing and release configuration. The normal CI also compiles the Rust shell on Linux. Local browser tests mock native IPC; they do not replace device testing or prove that a native package builds.

## Release to TestFlight

The **Mobile iOS TestFlight** GitHub Actions workflow builds the iOS app on a macOS runner, signs it for App Store distribution, checks the packaged app, and uploads it to App Store Connect. The app version comes from `package.json`; the build number (`CFBundleVersion`) is derived from the workflow run, so every upload is unique. The signed IPA is also kept as a workflow artifact for seven days.

### One-time Apple setup

1. In the [Apple Developer portal](https://developer.apple.com/account/resources/identifiers/list), register the explicit App ID `io.github.schachfeld.glow`. No extra capabilities are required; the `glow-lighting://` return link is a custom URL scheme and needs no entitlement.
2. In [App Store Connect](https://appstoreconnect.apple.com/apps), create a new iOS app named **Glow** with that bundle ID and any SKU.
3. Create an **Apple Distribution** certificate and export it from Keychain Access as a password-protected `.p12`.
4. Create an **App Store Connect** distribution provisioning profile for `io.github.schachfeld.glow` using that certificate, and download the `.mobileprovision` file.
5. In App Store Connect → **Users and Access → Integrations → App Store Connect API**, create a team key with the **App Manager** role. Download the `.p8` file (only possible once) and note its key ID and the issuer ID.

### Repository configuration

In **Settings → Secrets and variables → Actions**, add:

| Name                       | Type     | Value                                                         |
| -------------------------- | -------- | ------------------------------------------------------------- |
| `APPLE_DEVELOPMENT_TEAM`   | Variable | Your 10-character Apple team ID                               |
| `IOS_CERTIFICATE`          | Secret   | `base64 -i distribution.p12` output                           |
| `IOS_CERTIFICATE_PASSWORD` | Secret   | The `.p12` export password                                    |
| `IOS_MOBILE_PROVISION`     | Secret   | `base64 -i Glow_App_Store.mobileprovision` output             |
| `APPLE_API_ISSUER`         | Secret   | App Store Connect API issuer ID                               |
| `APPLE_API_KEY_ID`         | Secret   | App Store Connect API key ID                                  |
| `APPLE_API_KEY_P8`         | Secret   | Full contents of `AuthKey_<KEY_ID>.p8`, including its headers |

The workflow stops before building if any value is missing.

### Upload a build

1. Make sure the [login identity page](#publish-the-login-identity-page) is published; account sign-in cannot work without it.
2. Run **Mobile iOS TestFlight** from **Actions** on `main` or a release branch. Leave **Upload** enabled; disable it to only produce and check a signed IPA.
3. After App Store Connect finishes processing (usually 5–30 minutes), the build appears under **TestFlight**. Add it to an internal testing group, or submit it for beta review to use external testers. Beta review needs test notes explaining that a reachable Home Assistant instance is required, plus a demo instance or a screen recording.

The app declares `ITSAppUsesNonExemptEncryption = false`, because Glow only uses encryption for HTTPS/WSS connections and to protect saved sign-in credentials on the device. Confirm this matches your export-compliance assessment; if not, remove the key from `src-tauri/Info.ios.plist` and answer the encryption questions in App Store Connect instead. `src-tauri/PrivacyInfo.xcprivacy` declares no tracking or collected data, and the file-timestamp and elapsed-time APIs used by the Rust runtime. Fill in the App Store Connect privacy questionnaire as **Data Not Collected** to match. iOS app icons are opaque, as App Store Connect requires.

To build locally on a Mac instead, run `npm run tauri -- ios init`, copy `src-tauri/PrivacyInfo.xcprivacy` into the generated `src-tauri/gen/apple/*_iOS/` folder and run `xcodegen generate` in `src-tauri/gen/apple`. Then run `APPLE_DEVELOPMENT_TEAM=<team id> npm run tauri -- ios build --export-method app-store-connect` and upload the IPA from `src-tauri/gen/apple/build/` with Transporter.

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

## Light groups

Open a room and choose **Customize lights** to choose **Show as a group** or **Show individual lights** for each Home Assistant light group. Groups initially appear as one card with expandable individual controls. Your choice is saved on this device, separately for each Home Assistant address. It changes presentation only: room counts, room controls, and new Glow scenes use each underlying lamp once. Existing scenes containing group entities are expanded when read, with individual settings taking precedence.

Glow recognizes groups when every member can be resolved to a visible light in the same room. Groups with missing, hidden, cyclic, or cross-room membership retain their existing controls. Selected outer groups contain nested groups; partially overlapping groups appear as individual lights to avoid duplicate cards.

## Where scenes live

- New scenes are saved persistently in Home Assistant through its scene configuration API. They appear on all clients and can be used in automations, including after a Home Assistant restart.
- Saving requires an administrator account, the `config` integration, and `scene: !include scenes.yaml` (the standard setup). Mobile uses native HTTP with the current access token, including renewed account tokens.
- Glow editor settings and favorites remain in the add-on's `/data/scenes.json` or mobile app data, separated by Home Assistant address. A scene published on another client appears as a Home Assistant scene; edit it in Home Assistant.
- Older local scenes still work. Saving one again publishes it; there is no automatic migration. Clearing mobile app data removes local settings and unpublished scenes, but does not delete published Home Assistant scenes.
- Editing or deleting a published scene in its originating Glow client updates or deletes the Home Assistant scene too.

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
