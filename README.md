# Glow

**Your home, in a good light.** A room-first lighting app for Home Assistant, inspired by the simplicity of Hue.

Open a room, set its brightness, tap a scene, or make one of your own. No dashboard builder or YAML required.

## What you can do

- See your rooms automatically, using your Home Assistant Areas.
- Turn a room on or off, dim all its lights, or adjust individual bulbs.
- Set colors and white temperatures on supported lights.
- Create, edit, favorite, and delete scenes inside each room.
- Start from six color palettes, or capture your current light settings.
- Activate existing Home Assistant scenes alongside your Glow scenes.
- See live changes from other devices and Home Assistant.
- Use the same interface on a phone, tablet, or desktop.

## Install on Home Assistant OS

Source code is hosted at [schachfeld/easy-mode-lighting](https://github.com/schachfeld/easy-mode-lighting). Until the first tagged release is published, use the local installation below.

After the first successful release, add `https://github.com/schachfeld/easy-mode-lighting#home-assistant` in the Home Assistant app store's **Repositories** menu. Install **Glow** from that repository. Later releases appear as normal app updates, with prebuilt images for both supported architectures. The `home-assistant` branch is created automatically by the first successful release.

### Local installation

1. Download or build **`artifacts/glow-addon.tar.gz`**. To build it from source, run `npm ci` and `npm run package:addon`.
2. Extract it into Home Assistant’s `/local_apps` directory, so the app configuration is at **`/local_apps/glow/config.yaml`**. For example, use the `local_apps` share exposed by Home Assistant’s Samba share app. On older versions, the directory and share are named `addons`, giving `/addons/glow/config.yaml`. Copy the extracted `glow` folder, not the archive itself. See [Home Assistant’s local app instructions](https://developers.home-assistant.io/docs/apps/tutorial/).
3. In **Settings → Apps → App store**, open the menu and select **Check for updates**. On older versions, these are named **Add-ons → Add-on store**.
4. Find **Glow** under **Local apps**, select **Install**, and wait for the initial build.
5. Start Glow, enable **Show in sidebar**, and select **Open web UI**.

Glow connects through Home Assistant’s internal API automatically. You do not need to enter an address or access token. Rooms appear as soon as they contain light entities. Unassigned lights appear under **Other lights**.

Supports **amd64** and **aarch64**. The first install requires internet access to download the container base and dependencies. The installed interface, including its fonts and illustrations, is served locally.

## Try it on this computer

Requires Node.js 22.12+ (Node.js 24 recommended).

```sh
npm ci
npm run dev
```

Open **http://localhost:5180**. Without a Home Assistant connection, Glow starts a clearly labeled demo home. Its rooms, lights, and scenes work and persist locally; it does not control real lights.

For the production build:

```sh
npm run build
npm start
```

Open **http://localhost:8099**.

For development against a real instance, set `HA_URL` and `HA_TOKEN` on the server. Both are required. The token stays on the server and is never included in browser responses. A normal standalone server binds to loopback by default. The development Vite server is network-accessible, so only use it on a trusted development network.

| Variable           | Default           | Purpose                                                             |
| ------------------ | ----------------- | ------------------------------------------------------------------- |
| `HA_URL`           | unset             | Home Assistant base URL, such as `http://homeassistant.local:8123/` |
| `HA_TOKEN`         | unset             | Long-lived access token for standalone development                  |
| `SUPERVISOR_TOKEN` | provided by HA OS | Automatic app authentication; takes priority                        |
| `DATA_DIR`         | `.data`           | Scene storage; the app container uses `/data`                       |
| `PORT`             | `8099`            | Backend HTTP port                                                   |
| `HOST`             | `127.0.0.1`       | Standalone listen address; the HA OS app uses ingress only          |

## Standalone mobile app

The same React interface and lighting core also power a Tauri 2 app for Android and iOS. Mobile connects directly to Home Assistant over its WebSocket API, without installing the Glow add-on. It includes connection setup, optional encrypted credential storage, and device-local scenes.

See [the mobile guide](MOBILE.md) for prerequisites, build commands, architecture, and storage behavior. Preview its connection screen with `npm run dev:mobile`; build its frontend with `npm run build:mobile`. Custom Glow scenes are currently separate between mobile and the add-on; existing Home Assistant scenes appear in both.

## Scene storage

Glow scenes are saved atomically in `/data/scenes.json` inside the app. They survive app and Home Assistant restarts and are shared by all browsers. Include Glow when creating a Home Assistant backup. Demo data is isolated in `demo.json`.

Glow applies its scenes through Home Assistant’s `scene.apply` service. They are **not added to Home Assistant’s scene registry**, and therefore do not appear in its automation scene picker. Existing Home Assistant scenes can be activated and favorited in Glow; edit or delete those in Home Assistant. Multi-room native scenes appear in All scenes. If a saved scene references a removed or unavailable bulb, Glow asks you to fix or edit it rather than silently applying an incomplete scene.

## Development and checks

```sh
npm test
npm run build
npm run build:mobile
npx playwright install chromium --only-shell
npm run test:browser
docker build -t glow-lighting .
npm run package:addon
```

Integration tests use a real local WebSocket server to exercise authentication, discovery, service calls, live events, reconnecting, unavailable lights, and persistence. Browser tests cover the room controls, scene lifecycle, updates between tabs, and phone layout. Browser screenshots are written to `artifacts/`.

The server uses the official [WebSocket API](https://developers.home-assistant.io/docs/api/websocket/) and [app communication API](https://developers.home-assistant.io/docs/apps/communication/). The app only exposes its UI through authenticated Home Assistant ingress and rejects requests arriving directly from other containers. Scene changes require JSON and reject browser cross-site requests.

Built with React, TypeScript, Vite, Express, and a small WebSocket client. No cloud service is required.

## Releasing updates

GitHub Actions checks pull requests and changes to `main`. Pushing a version tag publishes the multi-architecture image, verifies anonymous downloads and container startup, creates a GitHub release, and updates the Home Assistant catalog. See [the release guide](RELEASING.md) for version preparation, the first release, and recovery from failed publication.
