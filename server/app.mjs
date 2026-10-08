import express from "express";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Store } from "./store.mjs";
import {
  createDemo,
  mapHome,
  palettes,
  validateSettings,
  serviceSettings,
} from "./model.mjs";

export function createApp({
  ha = null,
  dataDir = ".data",
  ingress = false,
  distDir = "dist",
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  const demo = !ha;
  const store = new Store(
    dataDir,
    demo ? "demo.json" : "scenes.json",
    demo ? createDemo() : { scenes: [], favorites: {} },
  );
  const subscribers = new Set();
  const state = () => ({
    ...(demo
      ? {
          rooms: store.data.rooms,
          lights: store.data.lights,
          scenes: store.data.scenes,
        }
      : mapHome(
          ha.states,
          ha.areas,
          ha.devices,
          ha.entities,
          store.data.scenes,
          store.data.favorites,
        )),
    mode: demo ? "demo" : "live",
    connected: demo || ha.connected,
    error: ha?.error ?? null,
    palettes,
  });
  const broadcast = () => {
    const message = `data: ${JSON.stringify(state())}\n\n`;
    for (const response of subscribers) response.write(message);
  };
  ha?.on("change", broadcast);
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

  const findScene = (id) => {
    const scene = state().scenes.find((s) => s.id === id);
    if (!scene)
      throw Object.assign(new Error("This scene no longer exists."), {
        status: 404,
      });
    return scene;
  };
  const requireConnection = () => {
    if (!demo && !ha.connected)
      throw Object.assign(
        new Error(
          "Home Assistant is disconnected. Try again when it reconnects.",
        ),
        { status: 503 },
      );
  };
  app.post("/api/lights", async (req, res) => {
    requireConnection();
    const { ids, settings: rawSettings } = req.body;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 500 ||
      ids.some((id) => typeof id !== "string")
    )
      throw new Error("Choose at least one light.");
    const settings = validateSettings(rawSettings);
    const home = state();
    const lights = [...new Set(ids)].map((id) => {
      const light = home.lights.find((l) => l.id === id);
      if (!light)
        throw new Error(
          "One of these lights no longer exists. Refresh and try again.",
        );
      if (!light.available)
        throw new Error(
          `${light.name} is unavailable. Check its power and connection.`,
        );
      return light;
    });
    if (demo) {
      store.save({
        ...store.data,
        lights: store.data.lights.map((l) =>
          ids.includes(l.id)
            ? { ...l, ...settings, on: settings.on ?? true }
            : l,
        ),
      });
      broadcast();
    } else {
      // Group equal settings into one service call, without assuming every bulb has the same capabilities.
      const groups = new Map();
      for (const light of lights) {
        const data =
          settings.on === false ? {} : serviceSettings(settings, light);
        const key = JSON.stringify(data);
        const group = groups.get(key) ?? { data, ids: [] };
        group.ids.push(light.id);
        groups.set(key, group);
      }
      for (const group of groups.values())
        await ha.call(
          "light",
          settings.on === false ? "turn_off" : "turn_on",
          group.data,
          { entity_id: group.ids },
        );
    }
    res.json({ ok: true });
  });

  function sceneInput(body, existing) {
    const home = state();
    if (
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.trim().length > 60
    )
      throw new Error("Give your scene a name of 1–60 characters.");
    const room = home.rooms.find((r) => r.id === body.roomId);
    if (!room) throw new Error("Choose a room for this scene.");
    if (!palettes.some((p) => p.id === body.palette))
      throw new Error("Choose a scene palette.");
    if (
      !body.lights ||
      typeof body.lights !== "object" ||
      Array.isArray(body.lights) ||
      !Object.keys(body.lights).length
    )
      throw new Error("Add at least one light to the scene.");
    const lights = {};
    for (const [id, settings] of Object.entries(body.lights)) {
      if (!home.lights.some((l) => l.id === id && l.roomId === room.id))
        throw new Error("Scenes can only contain lights in their room.");
      lights[id] = validateSettings(settings);
    }
    return {
      id: existing?.id ?? randomUUID(),
      name: body.name.trim(),
      roomId: room.id,
      palette: body.palette,
      lights,
      favorite: existing?.favorite ?? false,
      source: "glow",
    };
  }
  app.post("/api/scenes", (req, res) => {
    const scene = sceneInput(req.body);
    store.save({ ...store.data, scenes: [...store.data.scenes, scene] });
    broadcast();
    res.status(201).json(scene);
  });
  app.put("/api/scenes/:id", (req, res) => {
    const existing = findScene(req.params.id);
    if (existing.source !== "glow")
      throw new Error("Edit this scene in Home Assistant.");
    const scene = sceneInput(req.body, existing);
    store.save({
      ...store.data,
      scenes: store.data.scenes.map((s) => (s.id === scene.id ? scene : s)),
    });
    broadcast();
    res.json(scene);
  });
  app.delete("/api/scenes/:id", (req, res) => {
    const scene = findScene(req.params.id);
    if (scene.source !== "glow")
      throw new Error("Delete this scene in Home Assistant.");
    store.save({
      ...store.data,
      scenes: store.data.scenes.filter((s) => s.id !== scene.id),
    });
    broadcast();
    res.json({ ok: true });
  });
  app.post("/api/scenes/:id/favorite", (req, res) => {
    const scene = findScene(req.params.id);
    if (typeof req.body.favorite !== "boolean")
      throw new Error("Choose whether to favorite this scene.");
    if (scene.source === "glow")
      store.save({
        ...store.data,
        scenes: store.data.scenes.map((s) =>
          s.id === scene.id ? { ...s, favorite: req.body.favorite } : s,
        ),
      });
    else
      store.save({
        ...store.data,
        favorites: { ...store.data.favorites, [scene.id]: req.body.favorite },
      });
    broadcast();
    res.json({ ok: true });
  });
  app.post("/api/scenes/:id/activate", async (req, res) => {
    requireConnection();
    const scene = findScene(req.params.id);
    if (scene.source === "home-assistant")
      await ha.call("scene", "turn_on", {}, { entity_id: scene.entityId });
    else {
      const home = state();
      const entries = Object.entries(scene.lights);
      if (
        entries.some(
          ([id]) => !home.lights.some((l) => l.id === id && l.available),
        )
      )
        throw new Error(
          "A light in this scene is unavailable or was removed. Edit the scene or reconnect the light.",
        );
      if (demo) {
        store.save({
          ...store.data,
          lights: store.data.lights.map((l) =>
            scene.lights[l.id]
              ? {
                  ...l,
                  ...scene.lights[l.id],
                  on: scene.lights[l.id].on ?? true,
                }
              : l,
          ),
        });
        broadcast();
      } else {
        const entities = Object.fromEntries(
          entries.map(([id, settings]) => [
            id,
            {
              state: settings.on === false ? "off" : "on",
              ...(settings.on === false
                ? {}
                : serviceSettings(
                    settings,
                    home.lights.find((l) => l.id === id),
                  )),
            },
          ]),
        );
        await ha.call("scene", "apply", { entities });
      }
    }
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "This action does not exist." }),
  );
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
      ha?.off("change", broadcast);
      for (const res of subscribers) res.end();
    },
  };
}
