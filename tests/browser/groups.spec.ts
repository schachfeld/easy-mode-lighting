import { test, expect, type Page } from "@playwright/test";
import { nativeHost } from "./native-host";

async function connect(
  page: Page,
  address = "http://homeassistant.local:8123",
) {
  await page
    .getByRole("button", { name: "Use an access token instead" })
    .click();
  await page.getByLabel("Home Assistant address").fill(address);
  await page.getByLabel("Long-lived access token").fill("test-token");
  await page.getByRole("button", { name: "Connect to my home" }).click();
}

test("group controls, individual controls and per-home display preferences persist on mobile", async ({
  page,
}) => {
  await nativeHost(page, { groups: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 384, height: 805 });
  await page.goto("/mobile/");
  await connect(page);
  await page
    .getByRole("button", { name: "Open Arbeitszimmer", exact: true })
    .click();
  await expect(
    page.getByText("3 of 3 lights on", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kranbalk", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kranbalk 1", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("switch", { name: "Kranbalk power", exact: true })
    .click();
  await expect(
    page.getByText("0 of 3 lights on", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as any).__nativeCalls
          .filter((call: any) => call.type === "call_service")
          .at(-1).target.entity_id,
    ),
  ).toEqual(["light.kranbalk_1", "light.kranbalk_2", "light.kranbalk_3"]);
  await page.locator(".light-group-details > summary").click();
  await page
    .getByRole("switch", { name: "Kranbalk 1 power", exact: true })
    .click();
  await expect(
    page.getByText("3 lights · 1 on", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/glow-group-expanded.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "All rooms", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Schlafzimmer", exact: true })
    .click();
  await page.getByRole("button", { name: "Customize lights" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("radio", { name: /Show as a group/ }),
  ).toBeChecked();
  await page.evaluate(() => (window as any).__failSave());
  await dialog.getByRole("radio", { name: /Show individual lights/ }).click();
  await expect(dialog.getByRole("alert")).toContainText("Could not save");
  await expect(
    dialog.getByRole("radio", { name: /Show as a group/ }),
  ).toBeChecked();
  await dialog.getByRole("radio", { name: /Show individual lights/ }).check();
  await expect(
    dialog.getByRole("radio", { name: /Show individual lights/ }),
  ).toBeChecked();
  await page.screenshot({
    path: "artifacts/glow-group-preferences.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".light-group-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Stehlampe", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stockholm Lampe", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("0 of 2 lights on", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await expect(page.locator(".scene-light")).toHaveCount(2);
  await page.getByLabel("Scene name", { exact: true }).fill("Two lamps");
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await connect(page);
  await expect(page.locator(".light-group-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Stehlampe", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Activate Two lamps in Schlafzimmer",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/glow-group-individual.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "All rooms", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Arbeitszimmer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kranbalk", exact: true }),
  ).toBeVisible();
  await page.reload();
  await connect(page, "http://second-home.local:8123");
  await page.getByRole("button", { name: "All rooms", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Schlafzimmer", exact: true })
    .click();
  await expect(page.locator(".light-group-card")).toHaveCount(1);
  expect(errors).toEqual([]);
});
