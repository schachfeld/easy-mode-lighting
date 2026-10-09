import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mapHome } from "../packages/core/model.mjs";
import { createCore } from "../packages/core/controller.mjs";
import { roomLightLayout, lightTargets } from "../packages/core/groups.mjs";

function fixture() {
  const ha = Object.assign(new EventEmitter(), {
    connected: true,
    error: null,
    devices: [],
    areas: [
      { area_id: "office", name: "Arbeitszimmer" },
      { area_id: "bedroom", name: "Schlafzimmer" },
    ],
    entities: [],
    states: {},
  });
  const add = (id, members, room = "office", state = "on") => {
    ha.entities.push({ entity_id: id, area_id: room });
    ha.states[id] = {
      entity_id: id,
      state,
      attributes: {
        friendly_name: id,
        supported_color_modes: ["brightness"],
        brightness: 204,
        ...(members ? { entity_id: members } : {}),
      },
    };
  };
  for (const id of ["light.one", "light.two", "light.three"]) add(id);
  add("light.kranbalk", ["light.one", "light.two", "light.three"]);
  add("light.stehlampe", undefined, "bedroom", "off");
  add("light.stockholm", undefined, "bedroom", "off");
  add(
    "light.schlafzimmer",
    ["light.stehlampe", "light.stockholm"],
    "bedroom",
    "off",
  );
  const calls = [];
  ha.call = async (...args) => calls.push(args);
  const store = {
    data: { scenes: [], favorites: {} },
    async save(data) {
      this.data = structuredClone(data);
    },
  };
  const home = (preferences = {}) =>
    mapHome(
      ha.states,
      ha.areas,
      ha.devices,
      ha.entities,
      store.data.scenes,
      {},
      preferences,
    );
  return { ha, calls, store, add, home };
}

test("group preferences change presentation without changing unique room lights", () => {
  const { home } = fixture();
  const grouped = home();
  assert.equal(grouped.lights.length, 5);
  assert.equal(grouped.groups.length, 2);
  assert.deepEqual(
    roomLightLayout(grouped, "office").items.map((l) => l.id),
    ["light.kranbalk"],
  );
  const individual = home({ "light.schlafzimmer": "individual" });
  assert.deepEqual(
    roomLightLayout(individual, "bedroom").items.map((l) => l.id),
    ["light.stehlampe", "light.stockholm"],
  );
  assert.deepEqual(individual.lights, grouped.lights);
});

test("nested, duplicate and overlapping membership never duplicates displayed lamps or command targets", () => {
  const { add, home } = fixture();
  add("light.pair", ["light.one", "light.two", "light.one"]);
  add("light.outer", ["light.kranbalk", "light.pair"]);
  let model = home();
  assert.deepEqual(
    lightTargets(model, ["light.outer", "light.pair", "light.one"]).map(
      (l) => l.id,
    ),
    ["light.one", "light.two", "light.three"],
  );
  assert.equal(roomLightLayout(model, "office").items.length, 1);
  add("light.overlap", ["light.two", "light.three"]);
  model = home({ "light.kranbalk": "individual", "light.outer": "individual" });
  const layout = roomLightLayout(model, "office");
  assert.equal(layout.overlapping.length, 2);
  assert.deepEqual(
    layout.items.map((l) => l.id),
    ["light.one", "light.two", "light.three"],
  );
});

test("unknown, hidden, cyclic, and cross-room groups stay visible instead of losing controls", () => {
  const { add, home, ha } = fixture();
  add("light.missing", ["light.deleted"]);
  add("light.cycle_a", ["light.cycle_b"]);
  add("light.cycle_b", ["light.cycle_a"]);
  add("light.cross_room", ["light.one", "light.stehlampe"]);
  add("light.hidden", ["light.secret"]);
  add("light.secret");
  ha.entities.find((e) => e.entity_id === "light.secret").hidden_by = "user";
  const model = home();
  for (const id of [
    "light.missing",
    "light.cycle_a",
    "light.cycle_b",
    "light.cross_room",
    "light.hidden",
  ])
    assert.ok(model.lights.some((l) => l.id === id));
  assert.equal(model.groups.length, 2);
});

test("group status comes from members and partial availability does not inflate counts", () => {
  const { home, ha } = fixture();
  ha.states["light.one"].state = "off";
  ha.states["light.two"].state = "unavailable";
  ha.states["light.kranbalk"].state = "off";
  const model = home();
  const group = model.groups.find((g) => g.id === "light.kranbalk");
  assert.equal(group.on, true);
  assert.equal(group.available, true);
  assert.equal(group.brightness, 80);
  assert.equal(model.lights.filter((l) => l.on && l.available).length, 1);
});

test("preferences survive core recreation, validate input, and recover from a failed save", async () => {
  const { ha, store, calls } = fixture();
  const core = createCore({ ha, store });
  const scene = await core.execute("POST", "scenes", {
    name: "Keep me",
    roomId: "office",
    palette: "warm",
    lights: { "light.one": { on: true } },
  });
  await Promise.all([
    core.execute("PUT", "group-display", {
      groupId: "light.schlafzimmer",
      display: "individual",
    }),
    core.execute("PUT", "group-display", {
      groupId: "light.kranbalk",
      display: "group",
    }),
  ]);
  core.close();
  const restored = createCore({ ha, store });
  assert.equal(
    restored.state().groups.find((g) => g.id === "light.schlafzimmer").display,
    "individual",
  );
  assert.ok(restored.state().scenes.some((s) => s.id === scene.id));
  assert.deepEqual(calls, []);
  const save = store.save;
  store.save = async () => {
    throw new Error("Disk full");
  };
  await assert.rejects(
    restored.execute("PUT", "group-display", {
      groupId: "light.schlafzimmer",
      display: "group",
    }),
    /Disk full/,
  );
  assert.equal(
    restored.state().groups.find((g) => g.id === "light.schlafzimmer").display,
    "individual",
  );
  store.save = save;
  await assert.rejects(
    restored.execute("PUT", "group-display", {
      groupId: "light.deleted",
      display: "group",
    }),
    /no longer available/,
  );
  await assert.rejects(
    restored.execute("PUT", "group-display", {
      groupId: "light.kranbalk",
      display: "hidden",
    }),
    /Choose/,
  );
  restored.close();
});

test("commands deduplicate group members and existing scenes preserve individual overrides", async () => {
  const { ha, store, calls } = fixture();
  store.data.scenes = [
    {
      id: "legacy",
      name: "Legacy",
      source: "glow",
      roomId: "office",
      palette: "warm",
      lights: {
        "light.one": { on: true, brightness: 20 },
        "light.kranbalk": { on: true, brightness: 80 },
      },
    },
  ];
  const core = createCore({ ha, store });
  await core.execute("POST", "lights", {
    ids: ["light.kranbalk", "light.one", "light.two"],
    settings: { on: true, brightness: 50 },
  });
  assert.deepEqual(calls[0][3].entity_id, [
    "light.one",
    "light.two",
    "light.three",
  ]);
  await core.execute("POST", "scenes/legacy/activate");
  assert.deepEqual(Object.keys(calls[1][2].entities).sort(), [
    "light.one",
    "light.three",
    "light.two",
  ]);
  assert.equal(calls[1][2].entities["light.one"].brightness, 51);
  assert.equal(calls[1][2].entities["light.two"].brightness, 204);
  const saved = await core.execute("POST", "scenes", {
    name: "New",
    roomId: "office",
    palette: "warm",
    lights: { "light.kranbalk": { on: false } },
  });
  assert.deepEqual(Object.keys(saved.lights).sort(), [
    "light.one",
    "light.three",
    "light.two",
  ]);
  ha.states["light.two"].state = "unavailable";
  await assert.rejects(
    core.execute("POST", "lights", {
      ids: ["light.kranbalk"],
      settings: { on: true },
    }),
    /unavailable/,
  );
  assert.equal(calls.length, 2);
  core.close();
});
