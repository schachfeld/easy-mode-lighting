import { test, expect, type Page } from "@playwright/test";
import {
  arrangeHome,
  HomeAssistantClient,
  lights,
  resetLights,
} from "./home-assistant";

const ha = new HomeAssistantClient(
  process.env.GLOW_HA_URL!,
  process.env.GLOW_HA_TOKEN!,
);

const light = (id: string) => ha.state(`light.${id}`);
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const control = (page: Page, role: "switch" | "slider", name: string) =>
  page.getByRole(role, { name, exact: true });

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  await resetLights(ha);
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(button(page, "Open Living room")).toBeVisible();
});

test.afterEach(() => expect(errors).toEqual([]));

test("Home Assistant areas become rooms with their lights", async ({
  page,
}) => {
  await expect(button(page, "Open Bedroom")).toBeVisible();
  await expect(button(page, "Open Other lights")).toBeVisible();
  await button(page, "Open Living room").click();
  await expect(control(page, "switch", "Sofa lamp power")).toBeChecked();
  await expect(control(page, "slider", "Sofa lamp brightness")).toHaveValue(
    "50",
  );
  await expect(
    control(page, "switch", "Ceiling light power"),
  ).not.toBeChecked();
  // Existing Home Assistant scenes show up in the room they control.
  await expect(
    button(page, "Activate Evening glow in Living room"),
  ).toBeVisible();

  await button(page, "All rooms").click();
  await button(page, "Open Bedroom").click();
  await expect(control(page, "switch", "Wardrobe light power")).toBeDisabled();
  await expect(
    page.getByText("0 of 2 lights on", { exact: true }),
  ).toBeVisible();
});

test("room controls switch and dim the lights in Home Assistant", async ({
  page,
}) => {
  await button(page, "Open Living room").click();
  const room = control(page, "switch", "Living room all lights");
  await room.click();
  await expect.poll(async () => (await light("sofa_lamp")).state).toBe("off");
  await expect(room).not.toBeChecked();

  await room.click();
  await expect
    .poll(async () => [
      (await light("sofa_lamp")).state,
      (await light("ceiling_light")).state,
    ])
    .toEqual(["on", "on"]);

  await control(page, "slider", "Room brightness").focus();
  await page.keyboard.press("End");
  await expect
    .poll(async () => [
      (await light("sofa_lamp")).attributes.brightness,
      (await light("ceiling_light")).attributes.brightness,
    ])
    .toEqual([255, 255]);
});

test("colors and whites from the light editor reach the bulb", async ({
  page,
}) => {
  await button(page, "Open Living room").click();
  await page
    .locator(".light-card", { hasText: "Sofa lamp" })
    .getByRole("button", { name: "Adjust light" })
    .click();
  await page
    .getByRole("button", { name: /^Set color / })
    .nth(4)
    .click();
  await expect
    .poll(async () => {
      const { attributes } = await light("sofa_lamp");
      return [attributes.color_mode, attributes.rgb_color];
    })
    .toEqual(["rgb", [131, 181, 213]]);

  await button(page, "Cool").click();
  await expect
    .poll(async () => {
      const { attributes } = await light("sofa_lamp");
      return [attributes.color_mode, attributes.color_temp_kelvin];
    })
    .toEqual(["color_temp", 6000]);
  await expect(button(page, "Cool")).toHaveAttribute("aria-pressed", "true");
});

test("changes made in Home Assistant appear in Glow immediately", async ({
  page,
}) => {
  await button(page, "Open Bedroom").click();
  const bedside = control(page, "slider", "Bedside lamp brightness");
  await expect(bedside).toHaveValue("0");
  await ha.call("light", "turn_on", {
    entity_id: "light.bedside_lamp",
    brightness: 51,
  });
  await expect(control(page, "switch", "Bedside lamp power")).toBeChecked();
  await expect(bedside).toHaveValue("20");

  await button(page, "All rooms").click();
  await button(page, "Open Other lights").click();
  await ha.call("light", "turn_on", { entity_id: "light.porch_light" });
  await expect(control(page, "switch", "Porch light power")).toBeChecked();
});

test("Home Assistant scenes can be activated from Glow", async ({ page }) => {
  await ha.call("light", "turn_on", { entity_id: "light.ceiling_light" });
  await button(page, "Open Living room").click();
  await button(page, "Activate Evening glow in Living room").click();
  await expect
    .poll(async () => {
      const sofa = await light("sofa_lamp");
      return [sofa.attributes.brightness, (await light("ceiling_light")).state];
    })
    .toEqual([77, "off"]);
});

test("scenes made in Glow are saved, applied, and deleted in Home Assistant", async ({
  page,
}) => {
  const haScene = async () =>
    (await ha.states()).find(
      (s) =>
        s.entity_id.startsWith("scene.") &&
        s.attributes.friendly_name === "Reading corner",
    );
  await button(page, "Open Living room").click();
  await button(page, "Create scene").click();
  await page.getByLabel("Scene name", { exact: true }).fill("Reading corner");
  await page.getByRole("button", { name: "Use Ocean palette" }).click();
  await control(page, "slider", "Sofa lamp scene brightness").focus();
  await page.keyboard.press("End");
  await button(page, "Save scene").click();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await expect.poll(haScene).toBeTruthy();
  const scene = (await haScene())!;
  expect(scene.attributes.entity_id).toEqual(
    expect.arrayContaining(["light.sofa_lamp", "light.ceiling_light"]),
  );

  await ha.call("light", "turn_off", {
    entity_id: ["light.sofa_lamp", "light.ceiling_light"],
  });
  await expect(
    control(page, "switch", "Living room all lights"),
  ).not.toBeChecked();
  await button(page, "Activate Reading corner in Living room").click();
  await expect
    .poll(async () => {
      const sofa = await light("sofa_lamp");
      return [sofa.state, sofa.attributes.brightness];
    })
    .toEqual(["on", 255]);
  await expect(control(page, "switch", "Sofa lamp power")).toBeChecked();

  await button(page, "Edit Reading corner").click();
  await button(page, "Delete scene").click();
  await button(page, "Delete scene").last().click();
  await expect(
    button(page, "Activate Reading corner in Living room"),
  ).toHaveCount(0);
  await expect.poll(haScene).toBeUndefined();
});

// What Home Assistant itself says about rooms: area names and each light's area.
async function areaLayout() {
  const areas: { area_id: string; name: string }[] = await ha.ws(
    "config/area_registry/list",
  );
  const entities: { entity_id: string; area_id: string | null }[] = await ha.ws(
    "config/entity_registry/list",
  );
  const name = (id: string | null) =>
    areas.find((area) => area.area_id === id)?.name ?? null;
  return Object.fromEntries(
    lights.map((id) => [
      id,
      name(entities.find((e) => e.entity_id === id)?.area_id ?? null),
    ]),
  );
}

test.describe("rooms", () => {
  // Put every light back where global setup arranged it.
  test.afterEach(async () => {
    const areas: { area_id: string; name: string }[] = await ha.ws(
      "config/area_registry/list",
    );
    for (const area of areas.filter((a) =>
      ["Hallway", "Lounge"].includes(a.name),
    ))
      if (area.name === "Lounge")
        await ha.ws("config/area_registry/update", {
          area_id: area.area_id,
          name: "Living room",
        });
      else
        await ha.ws("config/area_registry/delete", { area_id: area.area_id });
    for (const entity_id of lights)
      await ha.ws("config/entity_registry/update", {
        entity_id,
        area_id: null,
      });
    await arrangeHome(ha);
  });

  test("a new room becomes a Home Assistant area with the chosen lights", async ({
    page,
  }) => {
    await button(page, "Create room").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Room name", { exact: true }).fill("Hallway");
    await dialog.getByRole("checkbox", { name: /Porch light/ }).check();
    await dialog.getByRole("checkbox", { name: /Sofa lamp/ }).check();
    await expect(dialog.getByText("Moves from Living room")).toBeVisible();
    await dialog.getByRole("button", { name: "Create room" }).click();
    await expect(dialog).not.toBeVisible();

    await expect.poll(areaLayout).toEqual({
      "light.sofa_lamp": "Hallway",
      "light.ceiling_light": "Living room",
      "light.bedside_lamp": "Bedroom",
      "light.wardrobe_light": "Bedroom",
      "light.porch_light": "Hallway",
    });
    // Glow opens the new room, and the porch light no longer has to sit
    // in “Other lights”.
    await expect(page.getByRole("heading", { name: "Hallway" })).toBeVisible();
    await expect(control(page, "switch", "Sofa lamp power")).toBeVisible();
    await expect(control(page, "switch", "Porch light power")).toBeVisible();
    await button(page, "All rooms").click();
    await expect(button(page, "Open Hallway")).toBeVisible();
    await expect(button(page, "Open Other lights")).toHaveCount(0);
  });

  test("lights move between rooms, and rooms can be renamed", async ({
    page,
  }) => {
    await button(page, "Open Bedroom").click();
    await page
      .locator(".light-card", { hasText: "Bedside lamp" })
      .getByRole("button", { name: "Adjust light" })
      .click();
    await page.getByLabel("Room", { exact: true }).selectOption("Living room");
    await expect
      .poll(async () => (await areaLayout())["light.bedside_lamp"])
      .toBe("Living room");
    await expect(page.getByRole("dialog")).toContainText("Living room");
    await button(page, "Done").click();
    await expect(control(page, "switch", "Bedside lamp power")).toHaveCount(0);

    await button(page, "All rooms").click();
    await button(page, "Open Living room").click();
    await expect(control(page, "switch", "Bedside lamp power")).toBeVisible();
    await button(page, "Edit room").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Room name", { exact: true }).fill("Lounge");
    await dialog.getByRole("checkbox", { name: /Ceiling light/ }).uncheck();
    await dialog.getByRole("button", { name: "Save room" }).click();
    await expect(dialog).not.toBeVisible();

    await expect.poll(areaLayout).toEqual({
      "light.sofa_lamp": "Lounge",
      "light.ceiling_light": null,
      "light.bedside_lamp": "Lounge",
      "light.wardrobe_light": "Bedroom",
      "light.porch_light": null,
    });
    await expect(page.getByRole("heading", { name: "Lounge" })).toBeVisible();
    await expect(control(page, "switch", "Ceiling light power")).toHaveCount(0);
    await button(page, "All rooms").click();
    await button(page, "Open Other lights").click();
    await expect(control(page, "switch", "Ceiling light power")).toBeVisible();
  });
});
