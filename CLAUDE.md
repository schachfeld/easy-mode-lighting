# Working on Glow

## Which apps are current

The React Native phone app in `native/` is the main focus of Glow: new features and design work go there first. The Home Assistant add-on (`server/` and the React UI in `src/`) is the other current version. The Tauri phone app (`src-tauri/` and `src/mobile/`) is deprecated. Make phone features and fixes in `native/`, not in the Tauri app, and do not upload Tauri builds to TestFlight: both apps share the bundle ID `io.github.schachfeld.glow`.

## Design

Read `DESIGN.md` before UI work in either app. It holds the palette, the contrast floor both themes must meet, type, icons and copy rules.

## Test new features against a real Home Assistant

Before you call a feature done, test it against Home Assistant running in Docker. Unit tests and demo-mode browser tests are not enough on their own.

```sh
npm run build
npm run build:mobile
npm run test:ha
```

- Add tests for the feature to `tests/ha/glow.spec.ts`, or to `tests/ha/sign-in.spec.ts` for sign-in (which covers the deprecated Tauri app's frontend). Check the result in Home Assistant itself, through its states, services, registries, or scene configuration, not only in the UI.
- If the feature needs another kind of light, add a mock light to `tests/ha/config/configuration.yaml`. The mock integration is in `tests/ha/config/custom_components/glow_mock_lights/`.
- For a change to the phone app in `native/`, also try it on an iOS Simulator or Android Emulator against the Home Assistant from `node --experimental-transform-types native/e2e/home-assistant.ts`, as described in `native/e2e/README.md`. There are no automated device tests yet.
- If Docker is unavailable, say so instead of skipping the suite silently.
