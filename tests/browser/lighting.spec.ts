import { test, expect } from "@playwright/test";

test("rooms, light controls, complete scene lifecycle, persistence, and mobile layout", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/glow-desktop.png", fullPage: true });
  await page
    .getByRole("switch", { name: "Living room lights", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Living room lights", exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Open Living room", exact: true })
    .click();
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await page.getByLabel("Scene name", { exact: true }).fill("Movie night");
  await page.getByRole("button", { name: "Use Ocean palette" }).click();
  await page
    .getByRole("slider", { name: "Floor lamp scene brightness" })
    .focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", {
      name: "Activate Movie night in Living room",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("switch", { name: "Floor lamp power", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("slider", { name: "Floor lamp brightness", exact: true }),
  ).toHaveValue("2");
  await page
    .getByRole("button", { name: "Favorite Movie night", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unfavorite Movie night", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Living room" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Activate Movie night in Living room",
      exact: true,
    }),
  ).toBeVisible();
  const otherPage = await context.newPage();
  await otherPage.goto("/");
  await expect(
    otherPage.getByRole("button", {
      name: "Activate Movie night in Living room",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All rooms", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Living room", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Movie night", exact: true })
    .click();
  await page.getByLabel("Scene name", { exact: true }).fill("Cinema time");
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(
    otherPage.getByRole("button", {
      name: "Activate Cinema time in Living room",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Cinema time", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete scene", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete scene", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", {
      name: "Activate Cinema time in Living room",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Adjust light" }).first().click();
  await page.getByRole("button", { name: "Cool", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cool", exact: true }),
  ).toHaveClass(/selected/);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  if (await page.getByRole("button", { name: "Dismiss notification" }).count())
    await page.getByRole("button", { name: "Dismiss notification" }).click();
  await page.screenshot({ path: "artifacts/glow-room.png", fullPage: true });
  await page.getByRole("button", { name: "All rooms", exact: true }).click();
  await page
    .getByRole("button", { name: "All lights off", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "All lights off", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Lights on", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All lights are off" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show all rooms", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/glow-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open Bedroom", exact: true }).click();
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/glow-scene-editor.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("failed commands restore the slider and browser back returns to the room list", async ({
  page,
}) => {
  let failLights = false;
  await page.routeWebSocket(/\/api\/websocket$/, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      if (failLights && message.path === "lights")
        socket.send(
          JSON.stringify({
            type: "result",
            id: message.id,
            status: 503,
            error: "Home Assistant is disconnected.",
          }),
        );
      else server.send(raw);
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open Living room", exact: true })
    .click();
  const slider = page.getByRole("slider", {
    name: "Room brightness",
    exact: true,
  });
  const original = await slider.inputValue();
  failLights = true;
  await slider.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("alert")).toContainText(
    "Home Assistant is disconnected.",
  );
  await expect(slider).toHaveValue(original);
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
});

test("assets, live events, room links, and actions work below the Home Assistant ingress prefix", async ({
  page,
}) => {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto("/api/hassio_ingress/glow-test/");
  await page.getByRole("button", { name: "Open Bedroom", exact: true }).click();
  await expect(page).toHaveURL(/hassio_ingress\/glow-test\/#\/rooms\/bedroom$/);
  const toggle = page.getByRole("switch", {
    name: "Bedroom all lights",
    exact: true,
  });
  const on = await toggle.isChecked();
  await toggle.click();
  if (on) await expect(toggle).not.toBeChecked();
  else await expect(toggle).toBeChecked();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bedroom" })).toBeVisible();
  expect(
    await page.evaluate(() => document.fonts.check('12px "DM Sans Variable"')),
  ).toBe(true);
  expect(failed).toEqual([]);
});

test("controls stream over the WebSocket and other tabs update instantly", async ({
  page,
  context,
}) => {
  const sent: number[] = [];
  await page.routeWebSocket(/\/api\/websocket$/, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      if (message.path === "lights" && message.body.settings.brightness)
        sent.push(message.body.settings.brightness);
      server.send(raw);
    });
  });
  const other = await context.newPage();
  await page.goto("/#/rooms/kitchen");
  await other.goto("/#/rooms/kitchen");
  const toggle = (target: typeof page) =>
    target.getByRole("switch", { name: "Kitchen all lights", exact: true });
  const on = await toggle(page).isChecked();
  await toggle(page).click();
  await expect(toggle(other)).toBeChecked({ checked: !on });

  const slider = page.getByRole("slider", {
    name: "Room brightness",
    exact: true,
  });
  const box = (await slider.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 4, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(box.x + (box.width * step) / 12, y);
    await page.waitForTimeout(60);
  }
  // The lights follow the drag before the slider is released.
  expect(sent.length).toBeGreaterThan(1);
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(
        await other
          .getByRole("slider", { name: "Room brightness", exact: true })
          .inputValue(),
      ),
    )
    .toBe(Number(await slider.inputValue()));
  await other.close();
});

test("light counts read naturally for one light and for many", async ({
  page,
}) => {
  await page.goto("/");
  const allOff = page.getByRole("button", {
    name: "All lights off",
    exact: true,
  });
  await expect(
    page.getByRole("button", { name: "Open Dining room", exact: true }),
  ).toBeVisible();
  if (await allOff.isEnabled()) await allOff.click();
  await expect(allOff).toBeDisabled();
  await expect(page.getByText("0 lights on", { exact: true })).toBeVisible();
  await expect(page.getByText("across 0 rooms", { exact: true })).toBeVisible();

  await page
    .getByRole("button", { name: "Open Dining room", exact: true })
    .click();
  await page
    .getByRole("switch", { name: "Table pendant power", exact: true })
    .click();
  await expect(
    page.getByText("1 of 2 lights on", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All rooms", exact: true }).click();
  await expect(page.getByText("1 light on", { exact: true })).toBeVisible();
  await expect(page.getByText("across 1 room", { exact: true })).toBeVisible();
  await expect(
    page.getByText("1 of 2 lights on", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("4 lights · All off", { exact: true }),
  ).toBeVisible();

  await allOff.click();
  await expect(allOff).toBeDisabled();
});
