import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8100",
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/browser-server.mjs",
    port: 8100,
    env: {
      PORT: "8100",
      DATA_DIR: mkdtempSync(join(tmpdir(), "glow-browser-")),
    },
    reuseExistingServer: false,
  },
});
