import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import {
  arrangeHome,
  startHomeAssistant,
  stopHomeAssistant,
  until,
} from "./home-assistant";

export const glowPort = Number(process.env.GLOW_E2E_PORT ?? 8101);
export const mobilePort = Number(process.env.GLOW_E2E_MOBILE_PORT ?? 8102);

// Boots Home Assistant in Docker, then a production Glow server connected to
// it with a real access token, exactly as a standalone install would run. The
// mobile build is served alongside it for the account sign-in tests.
export default async function globalSetup() {
  for (const [file, command] of [
    ["dist/index.html", "npm run build"],
    ["dist-mobile/index.html", "npm run build:mobile"],
  ])
    if (!existsSync(file))
      throw new Error(`Run \`${command}\` before the Home Assistant tests.`);
  const { id, ha } = await startHomeAssistant();
  const dataDir = mkdtempSync(join(tmpdir(), "glow-ha-e2e-"));
  let output = "";
  const glow = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      HA_URL: ha.url,
      HA_TOKEN: ha.token,
      PORT: String(glowPort),
      HOST: "127.0.0.1",
      DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  glow.stdout.on("data", (chunk) => (output += chunk));
  glow.stderr.on("data", (chunk) => (output += chunk));
  const mobile = express()
    .use("/mobile", express.static("dist-mobile"))
    .listen(mobilePort, "127.0.0.1");
  const teardown = async (failed = false) => {
    if (failed) console.error(output);
    glow.kill("SIGTERM");
    mobile.close();
    stopHomeAssistant(id, failed);
    rmSync(dataDir, { recursive: true, force: true });
  };
  try {
    await once(mobile, "listening");
    await arrangeHome(ha);
    await until("Glow to discover the rooms", async () => {
      if (glow.exitCode !== null) throw new Error(output);
      const response = await fetch(`http://127.0.0.1:${glowPort}/api/state`);
      const home = await response.json();
      return home.mode === "live" && home.connected && home.rooms.length === 3
        ? true
        : undefined;
    });
  } catch (error) {
    await teardown(true);
    throw error;
  }
  process.env.GLOW_HA_URL = ha.url;
  process.env.GLOW_HA_TOKEN = ha.token;
  process.env.GLOW_MOBILE_URL = `http://127.0.0.1:${mobilePort}/mobile/`;
  return () => teardown();
}
