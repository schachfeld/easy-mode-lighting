import express from "express";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Store } from "./store.mjs";
import { createDemo } from "../packages/core/model.mjs";
import { createCore } from "../packages/core/controller.mjs";

export function createApp({
  ha = null,
  dataDir = ".data",
  ingress = false,
  distDir = "dist",
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  const store = new Store(
    dataDir,
    ha ? "scenes.json" : "demo.json",
    ha ? { scenes: [], favorites: {} } : createDemo(),
  );
  const core = createCore({ ha, store, randomUUID });
  const state = core.state;
  const subscribers = new Set();
  const unsubscribe = core.subscribe(() => {
    const message = `data: ${JSON.stringify(state())}\n\n`;
    for (const response of subscribers) response.write(message);
  });
  app.use((req, res, next) => {
    // Only the authenticated Supervisor ingress proxy may reach an installed app.
    if (
      ingress &&
      !["172.30.32.2", "::ffff:172.30.32.2"].includes(req.socket.remoteAddress)
    )
      return res
        .status(403)
        .json({ error: "Open Glow through Home Assistant." });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    if (req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !req.is("application/json")
    )
      return res.status(415).json({ error: "Send requests as JSON." });
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["sec-fetch-site"] === "cross-site"
    )
      return res
        .status(403)
        .json({ error: "Cross-site requests are not allowed." });
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  app.get("/api/state", (_req, res) => res.json(state()));
  app.get("/api/events", (req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write(`data: ${JSON.stringify(state())}\n\n`);
    subscribers.add(res);
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20000);
    req.on("close", () => {
      clearInterval(heartbeat);
      subscribers.delete(res);
    });
  });

  app.use("/api", async (req, res) => {
    const path = req.path.replace(/^\//, "");
    const result = await core.execute(req.method, path, req.body);
    res
      .status(req.method === "POST" && path === "scenes" ? 201 : 200)
      .json(result);
  });
  app.use(express.static(resolve(distDir), { index: "index.html" }));
  app.use((error, _req, res, _next) => {
    const status = error.status ?? (error.code ? 500 : 400);
    res.status(status).json({
      error:
        status >= 500 && error.code
          ? "Could not save your changes. Check available storage and try again."
          : error.message,
    });
  });
  return {
    app,
    state,
    close() {
      unsubscribe();
      core.close();
      for (const res of subscribers) res.end();
    },
  };
}
