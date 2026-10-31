import { test, expect } from "@playwright/test";

// Each test sets up the demo state it needs; the demo home is shared across
// the whole browser run.

test("all lights off can be undone, restoring each light as it was", async ({
  page,
}) => {
  await page.goto("/#/rooms/office");
  const power = page.getByRole("switch", {
    name: "Office all lights",
    exact: true,
  });
  if (!(await power.isChecked())) await power.click();
  await expect(power).toBeChecked();
  await page
    .getByRole("slider", { name: "Room brightness", exact: true })
    .fill("42");
  await expect(
    page.getByRole("slider", { name: "Desk lamp brightness", exact: true }),
  ).toHaveValue("42");

  await page.getByRole("button", { name: "All rooms", exact: true }).click();
  await page
    .getByRole("button", { name: "All lights off", exact: true })
    .click();
  await expect(page.getByText("0 lights on", { exact: true })).toBeVisible();
  const toast = page.getByRole("status").filter({ hasText: "Turned off" });
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("switch", { name: "Office lights", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("slider", { name: "Office brightness", exact: true }),
  ).toHaveValue("42");
  await expect(toast).toHaveCount(0);
});

test("appearance follows the system and can be pinned to light or dark", async ({
  page,
}) => {
  const html = page.locator("html");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Settings & help" }).click();
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#f6f5f0",
  );
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Settings & help" }).click();
  await page.getByRole("radio", { name: "System", exact: true }).check();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("the color wheel and swatches set a light's color", async ({ page }) => {
  await page.goto("/#/rooms/dining-room");
  await page.getByRole("button", { name: "Adjust light" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Color", exact: true }).click();
  const lagoon = dialog.getByRole("button", { name: "Set color Lagoon" });
  await lagoon.click();
  await expect(lagoon).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("switch", { name: "Light power", exact: true }),
  ).toBeChecked();

  const wheel = dialog.getByRole("slider", { name: "Table pendant color" });
  const hue = async () => Number(await wheel.getAttribute("aria-valuenow"));
  const before = await hue();
  await wheel.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(hue).toBe(Math.round(before + 30) % 360);
  await expect(lagoon).toHaveAttribute("aria-pressed", "false");
  await expect(wheel).toHaveAttribute("aria-valuetext", /^Blue|^Cyan/);

  // Dragging picks hue from the angle and saturation from the distance.
  const box = (await wheel.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 2);
  await expect
    .poll(async () => Math.min(await hue(), 360 - (await hue())))
    .toBeLessThan(8);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /^Table pendant/ }).getByText("Red"),
  ).toBeVisible();
});

test("favorite scenes sit on their room card for one-tap moods", async ({
  page,
}) => {
  await page.goto("/#/rooms/kitchen");
  const favorite = page.getByRole("button", {
    name: "Favorite Warm glow",
    exact: true,
  });
  if (await favorite.count()) await favorite.click();
  await expect(
    page.getByRole("button", { name: "Unfavorite Warm glow", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All rooms", exact: true }).click();
  const chip = page.getByRole("button", {
    name: "Set Kitchen to Warm glow",
    exact: true,
  });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("switch", { name: "Kitchen lights", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("slider", { name: "Kitchen brightness", exact: true }),
  ).toHaveValue("65");
});

test("phones get a bottom tab bar and dialogs open as bottom sheets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const tabs = page.getByRole("navigation", { name: "Main navigation" });
  await expect(tabs).toHaveCount(1);
  await tabs.getByRole("button", { name: "Scenes", exact: true }).click();
  await expect(page).toHaveURL(/#\/scenes$/);
  await expect(
    page.getByRole("heading", { name: "Scenes", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Living room" }).getByRole("button", {
      name: "Activate Golden hour in Living room",
    }),
  ).toBeVisible();
  await tabs.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () => {
      const box = (await dialog.boundingBox())!;
      return [Math.round(box.width), Math.round(box.y + box.height)];
    })
    .toEqual([390, 844]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
