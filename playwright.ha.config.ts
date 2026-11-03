import { defineConfig } from "@playwright/test";

// End-to-end tests against a real Home Assistant running in Docker.
// Run with `npm run test:ha` after `npm run build`.
const port = Number(process.env.GLOW_E2E_PORT ?? 8101);

export default defineConfig({
  testDir: "./tests/ha",
  workers: 1,
  reporter: "list",
  timeout: 60000,
  globalSetup: "./tests/ha/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
});
