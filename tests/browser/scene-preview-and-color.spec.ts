import { test, expect, type Page } from "@playwright/test";

// Each test sets up the demo state it needs; the demo home is shared across
// the whole browser run. Light state is read from the server, so these tests
// check what the bulbs would do, not only what the interface shows.

async function light(page: Page, id: string) {
  const home = await (await page.request.get("/api/state")).json();
  return home.lights.find((l: { id: string }) => l.id === id);
}

test("the color wheel and white slider change a light as you drag", async ({
  page,
}) => {
  const sent: string[] = [];
  await page.routeWebSocket(/\/api\/websocket$/, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      if (message.path === "lights" && message.body.settings.color)
        sent.push(message.body.settings.color);
      server.send(raw);
    });
  });
  await page.goto("/#/rooms/bathroom");
  await page
    .locator(".light-card:not(.light-group-card) .light-name-button:visible")
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  const wheel = dialog.getByRole("slider", { name: "Mirror lights color" });
  const status = page
    .locator(".light-card", { hasText: "Mirror lights" })
    .locator(".light-name-button small");

  // Drag from red at the top, around to green-yellow on the right.
  const box = (await wheel.boundingBox())!;
  const [cx, cy, r] = [
    box.x + box.width / 2,
    box.y + box.height / 2,
    box.width / 2 - 6,
  ];
  await page.mouse.move(cx, cy - r);
  await page.mouse.down();
  for (let step = 1; step <= 12; step++) {
    const angle = (step / 12) * (Math.PI / 2);
    await page.mouse.move(cx + Math.sin(angle) * r, cy - Math.cos(angle) * r);
    await page.waitForTimeout(40);
  }
  // The light follows before the finger lifts.
  await expect(status).toHaveText("Lime");
  expect(sent.length).toBeGreaterThan(1);
  await page.mouse.up();
  await expect(wheel).toHaveAttribute("aria-valuetext", /^Lime/);
  await expect
    .poll(async () => (await light(page, "light.bathroom_0")).colorMode)
    .toBe("rgb");

  // Swatches move the wheel too.
  await dialog.getByRole("button", { name: "Set color Soft cyan" }).click();
  await expect(wheel).toHaveAttribute("aria-valuetext", /^Soft cyan/);
  await expect(status).toHaveText("Soft cyan");

  // The white slider sets any temperature the bulb supports.
  const whites = dialog.getByRole("slider", {
    name: "White temperature",
    exact: true,
  });
  await whites.fill("3500");
  await whites.fill("3000");
  await expect(status).toHaveText("3000 K · Warm white");
  await expect(wheel).toHaveAttribute("aria-valuetext", "White light");
  await expect
    .poll(() => light(page, "light.bathroom_0"))
    .toMatchObject({ colorMode: "color_temp", kelvin: 3000 });

  // The keyboard picks colors as well.
  await wheel.focus();
  await page.keyboard.press("ArrowRight");
  await expect(status).not.toContainText("K ·");

  // Tapping the white slider brings a white back, even where it already is.
  const track = (await whites.boundingBox())!;
  await page.mouse.click(
    track.x + (track.width * (3000 - 2000)) / (6500 - 2000),
    track.y + track.height / 2,
  );
  await expect(status).toContainText("K · Warm white");
});

test("the scene editor shows changes on the lights and puts them back when cancelled", async ({
  page,
}) => {
  const dialog = page.getByRole("dialog");
  await page.goto("/#/rooms/kitchen");
  const power = page.getByRole("switch", {
    name: "Kitchen all lights",
    exact: true,
  });
  if (await power.isChecked()) await power.click();
  await expect(power).not.toBeChecked();
  await expect
    .poll(async () => (await light(page, "light.kitchen_0")).on)
    .toBe(false);

  // Picking a palette shows it on the lights straight away.
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await page.getByRole("button", { name: "Use Forest palette" }).click();
  await expect
    .poll(() => light(page, "light.kitchen_0"))
    .toMatchObject({ on: true, brightness: 55, colorMode: "rgb" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(async () => (await light(page, "light.kitchen_0")).on)
    .toBe(false);

  // Editing a scene shows it; closing an untouched editor restores the room.
  await page
    .getByRole("button", { name: "Edit Warm glow", exact: true })
    .click();
  await expect
    .poll(() => light(page, "light.kitchen_2"))
    .toMatchObject({ on: true, brightness: 65, colorMode: "color_temp" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect
    .poll(async () => (await light(page, "light.kitchen_2")).on)
    .toBe(false);

  // Saving keeps the new look on the lights.
  const name = `Ocean ${Date.now()}`;
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await page.getByLabel("Scene name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Use Ocean palette" }).click();
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(300);
  expect(await light(page, "light.kitchen_0")).toMatchObject({
    on: true,
    brightness: 60,
    colorMode: "rgb",
  });

  // Each light has its own color picker, previewed on that light only.
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  await dialog
    .getByRole("button", { name: "Ceiling spots scene color" })
    .click();
  await dialog
    .getByRole("slider", { name: "Ceiling spots scene white temperature" })
    .fill("5000");
  await expect
    .poll(() => light(page, "light.kitchen_2"))
    .toMatchObject({ colorMode: "color_temp", kelvin: 5000 });
  expect((await light(page, "light.kitchen_0")).colorMode).toBe("rgb");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect
    .poll(async () => (await light(page, "light.kitchen_2")).colorMode)
    .toBe("rgb");
});
