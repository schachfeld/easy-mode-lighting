import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const image = process.argv[2];
const platform = process.argv[3] ?? "linux/amd64";
if (!image || !["linux/amd64", "linux/arm64"].includes(platform))
  throw new Error(
    "Usage: node scripts/smoke-container.mjs <image> [linux/amd64|linux/arm64]",
  );
const docker = (args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 180000 }).trim();
if (image.startsWith("ghcr.io/")) {
  docker(["pull", "--platform", platform, image]);
  const [metadata] = JSON.parse(docker(["image", "inspect", image]));
  assert.equal(metadata.Architecture, platform.split("/")[1]);
  if (process.env.GITHUB_SHA)
    assert.equal(
      metadata.Config.Labels["org.opencontainers.image.revision"],
      process.env.GITHUB_SHA,
    );
}
const id = docker([
  "run",
  "--rm",
  "-d",
  "--platform",
  platform,
  "-e",
  "HOST=0.0.0.0",
  "-p",
  "127.0.0.1::8099",
  image,
]);
try {
  const base = `http://${docker(["port", id, "8099/tcp"])}`;
  let state;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${base}/api/state`, {
        signal: AbortSignal.timeout(2000),
      });
      state = await response.json();
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  assert.equal(state?.mode, "demo", "Container did not become ready");
  assert.equal(state.rooms.length, 6);
  const html = await (await fetch(base)).text();
  assert.match(html, /Glow/);
  const script = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(new URL(script, `${base}/`))).status, 200);
  console.log(
    `Container verified on ${platform}: API, HTML, and bundled assets.`,
  );
} catch (error) {
  console.error(docker(["logs", id]));
  throw error;
} finally {
  docker(["stop", "--time", "5", id]);
}
