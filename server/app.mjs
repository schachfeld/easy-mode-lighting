import express from "express";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { WebSocketServer } from "ws";
import { Store } from "./store.mjs";
import { createDemo } from "../packages/core/model.mjs";
import { createCore } from "../packages/core/controller.mjs";

const supervisorAddresses = ["172.30.32.2", "::ffff:172.30.32.2"];
const maxMessageBytes = 128 * 1024;

function publicError(error) {
  const status = error.status ?? (error.code ? 500 : 400);
  return {
    status,
    error:
      status >= 500 && error.code
        ? "Could not save your changes. Check available storage and try again."
        : error.message,
  };
}

export function createApp({
  ha = null,
  dataDir = ".data",
  ingress = false,
  distDir = "dist",
  heartbeatMs = 20000,
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
  const streams = new Set();
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: maxMessageBytes,
  });
  // Serialize each update once, however many browsers are listening.
  const unsubscribe = core.subscribe((home) => {
    const json = JSON.stringify(home);
    for (const response of streams) response.write(`data: ${json}\n\n`);
    const message = `{"type":"state","home":${json}}`;
    for (const socket of sockets.clients)
      if (socket.readyState === 1) socket.send(message);
  });
  const allowed = (req) =>
    !ingress || supervisorAddresses.includes(req.socket.remoteAddress);

  app.use((req, res, next) => {
    // Only the authenticated Supervisor ingress proxy may reach an installed app.
    if (!allowed(req))
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
  // Server-sent events remain as a fallback for proxies without WebSockets.
  app.get("/api/events", (req, res) => {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write(`data: ${JSON.stringify(state())}\n\n`);
    streams.add(res);
    const heartbeat = setInterval(
      () => res.write(": heartbeat\n\n"),
      heartbeatMs,
    );
    req.on("close", () => {
      clearInterval(heartbeat);
      streams.delete(res);
    });
  });

  app.use("/api", async (req, res) => {
    const path = req.path.replace(/^\//, "");
    const result = await core.execute(req.method, path, req.body);
    res
      .status(req.method === "POST" && path === "scenes" ? 201 : 200)
      .json(result);
  });
  // Vite names built assets by content hash, so browsers can keep them for good
  // and skip revalidating every file each time Glow opens. The page itself
  // stays revalidated so updates appear immediately.
  app.use(
    "/assets",
    express.static(resolve(distDir, "assets"), {
      immutable: true,
      maxAge: "365d",
      index: false,
      fallthrough: false,
    }),
  );
  app.use(express.static(resolve(distDir), { index: "index.html" }));
  app.use((error, _req, res, _next) => {
    const { status, error: message } = publicError(error);
    res.status(status).json({ error: message });
  });

  sockets.on("connection", (socket) => {
    let alive = true;
    socket.on("pong", () => (alive = true));
    // Browsers cannot see protocol pings, so also send a small frame that lets
    // the client notice a silently dropped connection.
    const heartbeat = setInterval(() => {
      if (!alive) return socket.terminate();
      alive = false;
      socket.ping();
      socket.send('{"type":"heartbeat"}');
    }, heartbeatMs);
    socket.on("close", () => clearInterval(heartbeat));
    socket.on("error", () => socket.terminate());
    socket.on("message", async (raw, binary) => {
      let message;
      try {
        if (binary) throw new Error();
        message = JSON.parse(raw.toString());
        if (
          !Number.isSafeInteger(message?.id) ||
          typeof message.method !== "string" ||
          typeof message.path !== "string" ||
          (message.body !== undefined &&
            (typeof message.body !== "object" || message.body === null))
        )
          throw new Error();
      } catch {
        return socket.close(1003, "Send commands as JSON.");
      }
      const { id, method, path, body } = message;
      let reply;
      try {
        if (path === "state" || path === "events")
          throw Object.assign(new Error("This action does not exist."), {
            status: 404,
          });
        reply = {
          type: "result",
          id,
          result: (await core.execute(method, path, body ?? {})) ?? null,
        };
      } catch (error) {
        reply = { type: "result", id, ...publicError(error) };
      }
      if (socket.readyState === 1) socket.send(JSON.stringify(reply));
    });
    socket.send(JSON.stringify({ type: "state", home: state() }));
  });

  function upgrade(req, socket, head) {
    const reject = () => {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return true;
    };
    const { pathname } = new URL(req.url, "http://glow");
    // Accept any prefix, so Supervisor ingress and reverse proxies keep working.
    if (!pathname.endsWith("/api/websocket")) return false;
    if (!allowed(req)) return reject();
    // WebSockets are not covered by CORS. Refuse other sites, which could
    // otherwise drive the lights through a visitor's browser.
    const origin = req.headers.origin;
    const hosts = [req.headers.host, req.headers["x-forwarded-host"]]
      .flatMap((value) => value?.split(",") ?? [])
      .map((value) => value.trim().toLowerCase());
    let sameOrigin = !origin;
    try {
      sameOrigin ||= hosts.includes(new URL(origin).host.toLowerCase());
    } catch {
      sameOrigin = false;
    }
    if (req.headers["sec-fetch-site"] === "cross-site" || !sameOrigin)
      return reject();
    sockets.handleUpgrade(req, socket, head, (client) =>
      sockets.emit("connection", client, req),
    );
    return true;
  }

  return {
    app,
    state,
    upgrade,
    close() {
      unsubscribe();
      core.close();
      for (const res of streams) res.end();
      for (const socket of sockets.clients) socket.terminate();
      sockets.close();
    },
  };
}
