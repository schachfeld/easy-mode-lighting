import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  arrangeHome,
  startHomeAssistant,
  stopHomeAssistant,
  until,
} from "./home-assistant";

export const glowPort = Number(process.env.GLOW_E2E_PORT ?? 8101);

// Boots Home Assistant in Docker, then a production Glow server connected to
// it with a real access token, exactly as a standalone install would run.
export default async function globalSetup() {
  if (!existsSync("dist/index.html"))
    throw new Error("Run `npm run build` before the Home Assistant tests.");
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
  const teardown = async () => {
    glow.kill("SIGTERM");
    stopHomeAssistant(id);
    rmSync(dataDir, { recursive: true, force: true });
  };
  try {
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
    console.error(output);
    stopHomeAssistant(id, true);
    glow.kill("SIGTERM");
    rmSync(dataDir, { recursive: true, force: true });
    throw error;
  }
  process.env.GLOW_HA_URL = ha.url;
  process.env.GLOW_HA_TOKEN = ha.token;
  return teardown;
}
