import test from "node:test";
import assert from "node:assert/strict";
import { createCore } from "../packages/core/controller.mjs";
import { createDemo } from "../packages/core/model.mjs";

const memoryStore = (data) => ({
  data,
  save(next) {
    this.data = next;
  },
});

const light = (entity_id, extra = {}) => ({
  entity_id,
  state: "off",
  attributes: { supported_color_modes: ["brightness"], ...extra },
});

// A stand-in for HomeAssistant that applies registry commands like HA does.
function fakeHa() {
  const ha = {
    connected: true,
    error: null,
    states: {
      "light.lamp": light("light.lamp"),
      "light.spot": light("light.spot"),
      "light.desk": light("light.desk"),
      "light.group": light("light.group", {
        entity_id: ["light.lamp", "light.spot"],
      }),
      "light.legacy": light("light.legacy"),
    },
    areas: [{ area_id: "living", name: "Living room" }],
    devices: [{ id: "desk-device", area_id: "living" }],
    entities: [
      { entity_id: "light.lamp", area_id: "living" },
      { entity_id: "light.spot", area_id: "living" },
      { entity_id: "light.group", area_id: null },
      { entity_id: "light.desk", area_id: null, device_id: "desk-device" },
    ],
    commands: [],
    on() {},
    off() {},
    async registryUpdate(type, data) {
      ha.commands.push([type, data]);
      if (type === "config/area_registry/create") {
        const area = { area_id: data.name.toLowerCase(), name: data.name };
        ha.areas.push(area);
        return area;
      }
      if (type === "config/area_registry/update") {
        ha.areas.find((a) => a.area_id === data.area_id).name = data.name;
        return {};
      }
      if (type === "config/entity_registry/update") {
        ha.entities.find((e) => e.entity_id === data.entity_id).area_id =
          data.area_id;
        return {};
      }
      throw new Error(`Unexpected ${type}`);
    },
  };
  return ha;
}

const roomOf = (core, id) =>
  [...core.state().lights, ...core.state().groups].find((l) => l.id === id)
    .roomId;

test("creating a room makes a Home Assistant area and moves its lights", async () => {
  const ha = fakeHa();
  const core = createCore({ ha, store: memoryStore({ scenes: [] }) });
  const room = await core.execute("POST", "rooms", {
    name: " Kitchen ",
    lightIds: ["light.group"],
  });
  assert.deepEqual(room, { id: "kitchen", name: "Kitchen", style: "kitchen" });
  assert.equal(roomOf(core, "light.lamp"), "kitchen");
  assert.equal(roomOf(core, "light.spot"), "kitchen");
  // The group follows its members, so it stays a single control.
  assert.equal(roomOf(core, "light.group"), "kitchen");
  assert.ok(core.state().rooms.some((r) => r.id === "kitchen"));
  assert.ok(core.state().areas.some((a) => a.id === "kitchen"));
});

test("room names must be unique and not empty", async () => {
  const core = createCore({ ha: fakeHa(), store: memoryStore({ scenes: [] }) });
  await assert.rejects(
    core.execute("POST", "rooms", { name: "living ROOM", lightIds: [] }),
    /A room called living ROOM already exists/,
  );
  await assert.rejects(
    core.execute("POST", "rooms", { name: "  ", lightIds: [] }),
    /1–50 characters/,
  );
});

test("lights move between rooms and out of them", async () => {
  const ha = fakeHa();
  const core = createCore({ ha, store: memoryStore({ scenes: [] }) });
  await core.execute("PUT", "light-rooms", {
    ids: ["light.lamp"],
    roomId: "unassigned",
  });
  assert.equal(roomOf(core, "light.lamp"), "unassigned");
  assert.deepEqual(ha.commands.at(-1), [
    "config/entity_registry/update",
    { entity_id: "light.lamp", area_id: null },
  ]);
  // A light whose device is in an area cannot leave it from Glow.
  assert.equal(
    core.state().lights.find((l) => l.id === "light.desk").roomFromDevice,
    true,
  );
  await assert.rejects(
    core.execute("PUT", "light-rooms", {
      ids: ["light.desk"],
      roomId: "unassigned",
    }),
    /gets its room from its device/,
  );
  // Lights without a registry entry cannot get an area at all.
  await assert.rejects(
    core.execute("PUT", "light-rooms", {
      ids: ["light.legacy"],
      roomId: "living",
    }),
    /no unique ID/,
  );
  await assert.rejects(
    core.execute("PUT", "light-rooms", {
      ids: ["light.lamp"],
      roomId: "attic",
    }),
    /no longer exists/,
  );
});

test("editing a room renames it and sets exactly its lights", async () => {
  const ha = fakeHa();
  const core = createCore({ ha, store: memoryStore({ scenes: [] }) });
  await core.execute("PUT", "rooms/living", {
    name: "Lounge",
    lightIds: ["light.lamp", "light.desk"],
  });
  assert.equal(ha.areas[0].name, "Lounge");
  assert.equal(roomOf(core, "light.lamp"), "living");
  assert.equal(roomOf(core, "light.spot"), "unassigned");
  assert.equal(roomOf(core, "light.desk"), "living");
  // Keeping the same name sends nothing for it.
  const before = ha.commands.length;
  await core.execute("PUT", "rooms/living", { name: "Lounge" });
  assert.equal(ha.commands.length, before);
});

test("demo homes create rooms and move lights locally", async () => {
  const store = memoryStore(createDemo());
  const core = createCore({ store, randomUUID: () => "abc" });
  const room = await core.execute("POST", "rooms", {
    name: "Studio",
    lightIds: ["light.office_0"],
  });
  assert.equal(room.id, "room-abc");
  assert.equal(
    core.state().lights.find((l) => l.id === "light.office_0").roomId,
    "room-abc",
  );
  await core.execute("PUT", "light-rooms", {
    ids: ["light.office_0"],
    roomId: "unassigned",
  });
  assert.ok(core.state().rooms.some((r) => r.id === "unassigned"));
});
