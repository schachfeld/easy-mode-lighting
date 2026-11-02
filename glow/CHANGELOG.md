# Changelog

## [1.4.1] - 2026-11-02

- Mobile: replace the app icon with a glowing firefly jar. The Home Assistant add-on icon is unchanged.

## [1.4.0] - 2026-11-02

- Pick any color from a hue and saturation wheel, and set white temperature with a slider covering each bulb's full range. The wheel works with touch, mouse, and keyboard.
- Preview scenes on your lights while editing them. **Save** keeps the look; **Cancel**, discard, or delete restores the room to how it was before the editor opened.
- Show room scenes above the lights in each room, and remove the separate favorites section from the overview.
- Show consistent room brightness on cards and room pages by averaging only lights that are on and dimmable, and use correct singular and plural counts ("1 light on").
- Shrink the add-on image from 307 MB to 253 MB for faster installs and updates.
- Mobile: stay signed in using the iOS Keychain or Android Keystore, and reconnect automatically at launch. Existing passphrase-protected sign-ins move to secure storage the next time they are unlocked.
- Mobile: prepare the iOS app for TestFlight and support Xcode 27 builds.

Automated tests cover the color controls, scene previews, and room counts using a simulated server. Validation with physical lights is still pending.

## [1.3.0] - 2026-10-23

- Control lights in real time. Lights follow brightness sliders and color pickers while you drag, and toggles respond instantly instead of waiting for Home Assistant.
- Keep every light control usable while other commands or scene saves are in progress.
- Sync rooms, lights, and scenes between Glow tabs and Home Assistant over a single WebSocket that reconnects automatically after sleep or network changes. Glow falls back to its previous connection method if a proxy blocks WebSockets.
- Stay responsive in large homes by ignoring updates from sensors and other non-light entities, and by combining bursts of changes into one update.

Automated tests cover the WebSocket connection, command ordering, cross-site protection, and live updates between tabs using a simulated server. Validation of the WebSocket connection through Home Assistant ingress with physical lights is still pending.

## [1.2.0] - 2026-10-11

- Save new scenes as persistent Home Assistant scenes from both the add-on and mobile app, making them available to automations, dashboards, and other clients.
- Update and delete published scenes in Home Assistant when editing or deleting them in Glow. Keep a single scene card and follow Home Assistant entity renames.
- Publish older Glow scenes when they are next saved; existing local scenes continue to work without automatic migration.
- Show clear scene-save permission errors and keep the editor open without losing your work. Saving requires an administrator connection and Home Assistant's standard scene configuration.
- Show 0% on light, group, and room brightness sliders when the lights are off, while preserving their remembered brightness.

Automated tests cover the Home Assistant scene API and mobile flows using a simulated server. Validation against a real Home Assistant installation with physical lights is still pending.

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
