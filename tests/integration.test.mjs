import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { WebSocketServer } from "ws";
import { createApp } from "../server/app.mjs";
import { HomeAssistant } from "../server/home-assistant.mjs";
import { mapHome } from "../server/model.mjs";

async function fixture(t, options = {}) {
  const dataDir = options.dataDir ?? mkdtempSync(join(tmpdir(), "glow-test-"));
  const instance = createApp({ dataDir, ...options });
  const server = instance.app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    instance.close();
    await new Promise((resolve) => server.close(resolve));
    if (!options.dataDir) rmSync(dataDir, { recursive: true, force: true });
  });
  const request = async (path = "state", method = "GET", body) => {
    const response = await fetch(`${url}/api/${path}`, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    return { status: response.status, data: await response.json() };
  };
  return { ...instance, request, url, dataDir };
}

test("demo controls, scene CRUD, favorites, validation, and persistence across restarts", async (t) => {
  const app = await fixture(t);
  const initial = (await app.request()).data;
  assert.equal(initial.mode, "demo");
  assert.equal(initial.rooms.length, 6);
  const room = initial.rooms[0];
  const light = initial.lights.find((l) => l.roomId === room.id);
  let response = await app.request("lights", "POST", {
    ids: [light.id],
    settings: { on: true, brightness: 37, color: "#eeaabb", colorMode: "rgb" },
  });
  assert.equal(response.status, 200);
  assert.equal(
    (await app.request()).data.lights.find((l) => l.id === light.id).brightness,
    37,
  );
  const payload = {
    name: "Test movie night",
    roomId: room.id,
    palette: "sunset",
    lights: {
      [light.id]: {
        on: true,
        brightness: 31,
        color: "#aabbcc",
        colorMode: "rgb",
        kelvin: 2700,
      },
    },
  };
  const saved = (await app.request("scenes", "POST", payload)).data;
  assert.ok(saved.id);
  response = await app.request(`scenes/${saved.id}/activate`, "POST", {});
  assert.equal(response.status, 200);
  assert.equal(
    (await app.request()).data.lights.find((l) => l.id === light.id).color,
    "#aabbcc",
  );
  await app.request(`scenes/${saved.id}/favorite`, "POST", { favorite: true });
  await app.request(`scenes/${saved.id}`, "PUT", {
    ...payload,
    name: "Renamed scene",
  });
  const restored = await fixture(t, { dataDir: app.dataDir });
  const restoredScene = (await restored.request()).data.scenes.find(
    (s) => s.id === saved.id,
  );
  assert.equal(restoredScene.name, "Renamed scene");
  assert.equal(restoredScene.favorite, true);
  response = await app.request("lights", "POST", {
    ids: [light.id],
    settings: { brightness: 101 },
  });
  assert.equal(response.status, 400);
  response = await app.request("lights", "POST", {
    ids: ["switch.front_door"],
    settings: { on: true },
  });
  assert.equal(response.status, 400);
  response = await app.request("scenes", "POST", {
    ...payload,
    roomId: initial.rooms[1].id,
  });
  assert.equal(response.status, 400);
  assert.equal(
    (await app.request(`scenes/${saved.id}`, "DELETE", {})).status,
    200,
  );
  assert.equal(
    (await app.request()).data.scenes.some((s) => s.id === saved.id),
    false,
  );
});

const haStates = [
  {
    entity_id: "light.color",
    state: "on",
    attributes: {
      friendly_name: "Color lamp",
      brightness: 128,
      supported_color_modes: ["rgb"],
      rgb_color: [250, 180, 90],
    },
  },
  {
    entity_id: "light.white",
    state: "off",
    attributes: {
      friendly_name: "White lamp",
      supported_color_modes: ["color_temp"],
      min_color_temp_kelvin: 2500,
      max_color_temp_kelvin: 5000,
    },
  },
  {
    entity_id: "light.basic",
    state: "on",
    attributes: { supported_color_modes: ["onoff"] },
  },
  {
    entity_id: "light.unavailable",
    state: "unavailable",
    attributes: { supported_color_modes: ["brightness"] },
  },
  { entity_id: "light.hidden", state: "on", attributes: {} },
  {
    entity_id: "scene.evening",
    state: "unknown",
    attributes: {
      friendly_name: "Evening",
      entity_id: ["light.color", "light.white"],
    },
  },
];
const entities = [
  { entity_id: "light.color", device_id: "device-1" },
  { entity_id: "light.white", device_id: "device-2", area_id: "living" },
  { entity_id: "light.hidden", hidden_by: "user", area_id: "living" },
];
const areas = [
  { area_id: "living", name: "Living room" },
  { area_id: "kitchen", name: "Kitchen" },
];
const devices = [
  { id: "device-1", area_id: "living" },
  { id: "device-2", area_id: "kitchen" },
];

test("discovers entity and device Areas, unassigned lights, capabilities, and native scenes", () => {
  const mapped = mapHome(
    Object.fromEntries(haStates.map((s) => [s.entity_id, s])),
    areas,
    devices,
    entities,
    [],
  );
  assert.deepEqual(
    mapped.rooms.map((r) => r.id),
    ["living", "unassigned"],
  );
  assert.equal(
    mapped.lights.find((l) => l.id === "light.white").roomId,
    "living",
  );
  assert.equal(
    mapped.lights.find((l) => l.id === "light.basic").dimmable,
    false,
  );
  assert.equal(
    mapped.lights.find((l) => l.id === "light.unavailable").available,
    false,
  );
  assert.equal(
    mapped.lights.some((l) => l.id === "light.hidden"),
    false,
  );
  assert.equal(mapped.scenes[0].roomId, "living");
});

async function mockHa(t) {
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(wss, "listening");
  const calls = [];
  let failServices = false;
  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "auth_required" }));
    socket.on("message", (raw) => {
      const m = JSON.parse(raw);
      if (m.type === "auth")
        return socket.send(
          JSON.stringify({
            type: m.access_token === "test-token" ? "auth_ok" : "auth_invalid",
          }),
        );
      if (m.type === "call_service") calls.push(m);
      const responses = {
        get_states: haStates,
        "config/area_registry/list": areas,
        "config/device_registry/list": devices,
        "config/entity_registry/list": entities,
      };
      socket.send(
        JSON.stringify({
          type: m.type === "ping" ? "pong" : "result",
          id: m.id,
          success: !(failServices && m.type === "call_service"),
          result: responses[m.type] ?? null,
          error: { message: "Light service failed" },
        }),
      );
    });
  });
  const ha = new HomeAssistant({
    url: `ws://127.0.0.1:${wss.address().port}`,
    token: "test-token",
    retryMs: 20,
    timeoutMs: 1000,
  });
  t.after(async () => {
    ha.stop();
    for (const client of wss.clients) client.terminate();
    await new Promise((resolve) => wss.close(resolve));
  });
  const ready = once(ha, "change");
  ha.start();
  await ready;
  assert.equal(ha.connected, true);
  return {
    ha,
    calls,
    wss,
    fail() {
      failServices = true;
    },
  };
}

test("real WebSocket handshake, service targeting, capability filtering, scene application, and errors", async (t) => {
  const mock = await mockHa(t);
  const { request } = await fixture(t, { ha: mock.ha });
  assert.equal((await request()).data.mode, "live");
  let response = await request("lights", "POST", {
    ids: ["light.color", "light.white", "light.basic"],
    settings: {
      on: true,
      brightness: 50,
      colorMode: "color_temp",
      kelvin: 2000,
    },
  });
  assert.equal(response.status, 200);
  assert.equal(mock.calls.length, 3);
  assert.deepEqual(mock.calls[0].target.entity_id, ["light.color"]);
  assert.deepEqual(mock.calls[0].service_data, { brightness: 128 });
  assert.deepEqual(mock.calls[1].service_data, {
    brightness: 128,
    color_temp_kelvin: 2500,
  });
  assert.deepEqual(mock.calls[2].service_data, {});
  response = await request("lights", "POST", {
    ids: ["light.unavailable"],
    settings: { on: true },
  });
  assert.equal(response.status, 400);
  const saved = (
    await request("scenes", "POST", {
      name: "Cozy",
      roomId: "living",
      palette: "warm",
      lights: {
        "light.color": {
          on: true,
          brightness: 60,
          color: "#aabbcc",
          colorMode: "rgb",
        },
        "light.white": { on: false },
      },
    })
  ).data;
  await request(`scenes/${saved.id}/activate`, "POST", {});
  const call = mock.calls.at(-1);
  assert.equal(call.domain, "scene");
  assert.equal(call.service, "apply");
  assert.deepEqual(call.service_data.entities["light.color"], {
    state: "on",
    brightness: 153,
    rgb_color: [170, 187, 204],
  });
  assert.deepEqual(call.service_data.entities["light.white"], { state: "off" });
  await request("scenes/scene.evening/activate", "POST", {});
  assert.equal(mock.calls.at(-1).service, "turn_on");
  assert.equal(mock.calls.at(-1).target.entity_id, "scene.evening");
  assert.equal(
    (await request("scenes/scene.evening", "DELETE", {})).status,
    400,
  );
  mock.fail();
  response = await request("lights", "POST", {
    ids: ["light.color"],
    settings: { on: false },
  });
  assert.equal(response.status, 400);
  assert.match(response.data.error, /failed/);
  mock.ha.connected = false;
  response = await request("lights", "POST", {
    ids: ["light.color"],
    settings: { on: false },
  });
  assert.equal(response.status, 503);
});

test("live state events are streamed to clients, and reconnect reloads discovery", async (t) => {
  const { ha, wss } = await mockHa(t);
  const app = await fixture(t, { ha });
  const abort = new AbortController();
  const response = await fetch(`${app.url}/api/events`, {
    signal: abort.signal,
  });
  const reader = response.body.getReader();
  await reader.read();
  const updated = { ...haStates[0], state: "off" };
  for (const socket of wss.clients)
    socket.send(
      JSON.stringify({
        type: "event",
        event: {
          event_type: "state_changed",
          data: { entity_id: updated.entity_id, new_state: updated },
        },
      }),
    );
  const next = await reader.read();
  const data = JSON.parse(
    new TextDecoder()
      .decode(next.value)
      .trim()
      .replace(/^data: /, ""),
  );
  assert.equal(data.lights.find((l) => l.id === "light.color").on, false);
  abort.abort();
  const disconnected = once(ha, "change");
  for (const socket of wss.clients) socket.close();
  await disconnected;
  assert.equal(ha.connected, false);
  await once(ha, "change");
  assert.equal(ha.connected, true);
  assert.equal(ha.states["light.color"].state, "on");
});

test("ingress blocks direct access; mutations reject cross-site and non-JSON requests", async (t) => {
  const ingress = await fixture(t, { ingress: true });
  assert.equal((await ingress.request()).status, 403);
  const app = await fixture(t);
  const crossSite = await fetch(`${app.url}/api/lights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "cross-site",
    },
    body: "{}",
  });
  assert.equal(crossSite.status, 403);
  const form = await fetch(`${app.url}/api/lights`, {
    method: "POST",
    body: "on=true",
  });
  assert.equal(form.status, 415);
});
