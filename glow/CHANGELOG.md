# Changelog

## [1.1.0] - 2026-10-09

- Choose grouped or individual light controls through **Room → Customize lights**. Group cards expand to reveal their lamps, and display preferences persist for each home.
- Resolve known, same-room light groups so room counts, commands, and scenes use each lamp once. Existing group-based scenes preserve individual lamp overrides.
- Add a Tauri mobile app that shares the add-on's lighting interface and connects directly to Home Assistant, with account sign-in, manual-token support, optional encrypted credentials, and device-local scenes.
- Prefill the default Home Assistant address and remove unnecessary scrolling from Android connection setup.
- Add automated coverage for group controls, preference persistence, mobile authentication, and native builds.

The downloadable release assets are Home Assistant add-on packages. Mobile builds are available from source or through the Android debug build workflow; see the mobile guide.

## [1.0.1] - 2026-10-08

- Fix container verification on Docker's classic image store so both amd64 and ARM64 are tested before publication.
- First installable public release: automatic rooms, light controls, persistent room scenes, and Home Assistant sidebar access.

Automated checks cover the app and both container architectures. Validation on a real Home Assistant installation with physical lights is still pending.

## [1.0.0] - 2026-10-08

- Discover Home Assistant rooms and lights automatically.
- Control room brightness, individual lights, colors, and white temperatures.
- Create, edit, favorite, and activate persistent room scenes.
- Synchronize controls across browsers with live updates and reconnection.
- Install through Home Assistant OS with authenticated sidebar access.
- Provide an interactive demo and layouts for phones, tablets, and desktops.

Glow scenes are stored in the app; they do not become Home Assistant scene entities for automations. Existing Home Assistant scenes can be activated and favorited.
