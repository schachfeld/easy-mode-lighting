import express from "express";
import { createApp } from "../server/app.mjs";

const instance = createApp({ dataDir: process.env.DATA_DIR });
const app = express();
// Mirror Supervisor's path prefix, while leaving the root available for normal tests.
app.use("/api/hassio_ingress/glow-test", instance.app);
app.use(instance.app);
const server = app.listen(Number(process.env.PORT), "127.0.0.1");
process.on("SIGTERM", () => {
  instance.close();
  server.close(() => process.exit(0));
});
