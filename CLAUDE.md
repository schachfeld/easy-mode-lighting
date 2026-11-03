# Working on Glow

## Test new features against a real Home Assistant

Before you call a feature done, test it against Home Assistant running in Docker. Unit tests and demo-mode browser tests are not enough on their own.

```sh
npm run build
npm run build:mobile
npm run test:ha
```

- Add tests for the feature to `tests/ha/glow.spec.ts`, or to `tests/ha/sign-in.spec.ts` for mobile sign-in. Check the result in Home Assistant itself, through its states, services, registries, or scene configuration, not only in the UI.
- If the feature needs another kind of light, add a mock light to `tests/ha/config/configuration.yaml`. The mock integration is in `tests/ha/config/custom_components/glow_mock_lights/`.
- If Docker is unavailable, say so instead of skipping the suite silently.
