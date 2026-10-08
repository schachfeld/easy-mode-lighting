import { HomeAssistant } from "./home-assistant.mjs";
import { createApp } from "./app.mjs";

const supervisor = Boolean(process.env.SUPERVISOR_TOKEN);
let ha = null;
if (supervisor || process.env.HA_URL || process.env.HA_TOKEN) {
  if (!supervisor && (!process.env.HA_URL || !process.env.HA_TOKEN))
    throw new Error(
      "Set both HA_URL and HA_TOKEN, or unset both to use the demo.",
    );
  const url = supervisor
    ? "ws://supervisor/core/websocket"
    : new URL(
        "api/websocket",
        process.env.HA_URL.replace(/\/?$/, "/"),
      ).href.replace(/^http/, "ws");
  ha = new HomeAssistant({
    url,
    token: supervisor ? process.env.SUPERVISOR_TOKEN : process.env.HA_TOKEN,
  });
  ha.start();
}
const instance = createApp({
  ha,
  ingress: supervisor,
  dataDir: process.env.DATA_DIR ?? ".data",
});
const port = Number(process.env.PORT ?? 8099);
const host = supervisor ? "0.0.0.0" : (process.env.HOST ?? "127.0.0.1");
const server = instance.app.listen(port, host, () =>
  console.log(
    `Glow is ready at http://${host}:${port} (${ha ? "Home Assistant" : "demo"})`,
  ),
);
function stop() {
  instance.close();
  ha?.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
