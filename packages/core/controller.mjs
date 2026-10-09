import {
  mapHome,
  palettes,
  validateSettings,
  serviceSettings,
} from "./model.mjs";

// All lighting and scene behavior lives here. Storage and transport are supplied
// by the host; no Node, browser, or Tauri APIs are needed in this module.
export function createCore({
  ha = null,
  store,
  randomUUID = () => globalThis.crypto.randomUUID(),
}) {
  const demo = !ha;
  const subscribers = new Set();
  const handlers = new Map();
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
    for (const callback of subscribers) callback(state());
  };
  ha?.on("change", broadcast);
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
  handlers.set("POST lights", async (body, id) => {
    requireConnection();
    const { ids, settings: rawSettings } = body;
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
      await store.save({
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
    return { ok: true };
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
  handlers.set("POST scenes", async (body, id) => {
    const scene = sceneInput(body);
    await store.save({ ...store.data, scenes: [...store.data.scenes, scene] });
    broadcast();
    return scene;
  });
  handlers.set("PUT scenes/:id", async (body, id) => {
    const existing = findScene(id);
    if (existing.source !== "glow")
      throw new Error("Edit this scene in Home Assistant.");
    const scene = sceneInput(body, existing);
    await store.save({
      ...store.data,
      scenes: store.data.scenes.map((s) => (s.id === scene.id ? scene : s)),
    });
    broadcast();
    return scene;
  });
  handlers.set("DELETE scenes/:id", async (body, id) => {
    const scene = findScene(id);
    if (scene.source !== "glow")
      throw new Error("Delete this scene in Home Assistant.");
    await store.save({
      ...store.data,
      scenes: store.data.scenes.filter((s) => s.id !== scene.id),
    });
    broadcast();
    return { ok: true };
  });
  handlers.set("POST scenes/:id/favorite", async (body, id) => {
    const scene = findScene(id);
    if (typeof body.favorite !== "boolean")
      throw new Error("Choose whether to favorite this scene.");
    if (scene.source === "glow")
      await store.save({
        ...store.data,
        scenes: store.data.scenes.map((s) =>
          s.id === scene.id ? { ...s, favorite: body.favorite } : s,
        ),
      });
    else
      await store.save({
        ...store.data,
        favorites: { ...store.data.favorites, [scene.id]: body.favorite },
      });
    broadcast();
    return { ok: true };
  });
  handlers.set("POST scenes/:id/activate", async (body, id) => {
    requireConnection();
    const scene = findScene(id);
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
        await store.save({
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
    return { ok: true };
  });

  // Serialize writes so asynchronous mobile persistence cannot lose an edit.
  let queue = Promise.resolve();
  return {
    state,
    subscribe(callback) {
      subscribers.add(callback);
      callback(state());
      return () => subscribers.delete(callback);
    },
    execute(method, path, body = {}) {
      const parts = path.split("/");
      const id =
        parts[0] === "scenes" && parts.length > 1
          ? decodeURIComponent(parts[1])
          : undefined;
      const key =
        id === undefined
          ? path
          : ["scenes", ":id", ...parts.slice(2)].join("/");
      const handler = handlers.get(`${method} ${key}`);
      if (!handler)
        return Promise.reject(
          Object.assign(new Error("This action does not exist."), {
            status: 404,
          }),
        );
      const task = queue.then(() => handler(body, id));
      queue = task.catch(() => {});
      return task;
    },
    close() {
      ha?.off("change", broadcast);
      subscribers.clear();
    },
  };
}
