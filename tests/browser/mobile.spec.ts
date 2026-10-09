import { test, expect, type Page } from "@playwright/test";

// Exercise the real mobile UI, native adapter and shared HA protocol. Only the
// Tauri IPC boundary is mocked; native Rust compilation is a separate CI check.
import { nativeHost } from "./native-host";

async function connect(
  page: Page,
  token = "test-token",
  address = "http://homeassistant.local:8123",
) {
  await expect(page.getByLabel("Home Assistant address")).toBeVisible();
  if (
    await page
      .getByRole("button", { name: "Use an access token instead" })
      .count()
  )
    await page
      .getByRole("button", { name: "Use an access token instead" })
      .click();
  await page.getByLabel("Home Assistant address").fill(address);
  await page.getByLabel("Long-lived access token").fill(token);
  await page.getByRole("button", { name: "Connect to my home" }).click();
}

test("mobile connects directly, controls lights, persists scenes per home and disconnects", async ({
  page,
}) => {
  await nativeHost(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mobile/");
  await expect(
    page.getByRole("heading", { name: "A little closer to home." }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/glow-mobile-connect.png",
    fullPage: true,
  });
  await connect(page);
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
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
  await page.getByLabel("Scene name", { exact: true }).fill("Mobile evening");
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.screenshot({
    path: "artifacts/glow-mobile-room.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => Object.values(localStorage).join(" ")),
  ).not.toContain("test-token");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little closer to home." }),
  ).toBeVisible();
  await connect(page);
  await expect(
    page.getByRole("button", {
      name: "Activate Mobile evening in Living room",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /connected/ }).click();
  await expect(
    page.getByText("Glow scenes stay on this device.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.getByLabel("Long-lived access token")).toHaveValue("");
  await connect(page, "test-token", "http://second-home.local:8123");
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Activate Mobile evening in Living room",
      exact: true,
    }),
  ).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile reports invalid tokens and failed saves without losing the editor", async ({
  page,
}) => {
  await nativeHost(page);
  await page.goto("/mobile/");
  await connect(page, "bad-token");
  await expect(page.getByRole("alert")).toContainText("rejected");
  await connect(page);
  await page
    .getByRole("button", { name: "Open Living room", exact: true })
    .click();
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await page.getByLabel("Scene name", { exact: true }).fill("Keep my work");
  await page.evaluate(() => (window as any).__failSave());
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText(
      "Could not save your scenes. Check the device’s available storage.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("mobile preview explains native-only connection and offers encrypted remembering", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mobile/");
  await page
    .getByRole("button", { name: "Use an access token instead" })
    .click();
  await page.getByLabel("Remember this connection").check();
  await expect(page.getByLabel("Create a vault passphrase")).toBeVisible();
  await expect(page.getByLabel("Confirm passphrase")).toBeVisible();
  await page.getByLabel("Remember this connection").uncheck();
  await connect(page);
  await expect(page.getByRole("alert")).toContainText(
    "mobile interface preview",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("remembered credentials use the native vault, unlock errors are recoverable, and forgetting returns to setup", async ({
  page,
}) => {
  await nativeHost(page);
  await page.goto("/mobile/");
  await page
    .getByRole("button", { name: "Use an access token instead" })
    .click();
  await page.getByLabel("Remember this connection").check();
  await page
    .getByLabel("Create a vault passphrase")
    .fill("correct horse battery staple");
  await page
    .getByLabel("Confirm passphrase")
    .fill("correct horse battery staple");
  await connect(page);
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__vaultUnloads())).toBe(1);
  await page.getByRole("button", { name: /connected/ }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome home." }),
  ).toBeVisible();
  await page.getByLabel("Vault passphrase").fill("wrong passphrase");
  await page.getByRole("button", { name: "Unlock & connect" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not unlock");
  await page
    .getByLabel("Vault passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Unlock & connect" }).click();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__vaultUnloads())).toBe(2);
  expect(
    await page.evaluate(() => Object.values(localStorage).join(" ")),
  ).not.toContain("test-token");
  await page.getByRole("button", { name: /connected/ }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page.getByRole("button", { name: "Forget saved connection" }).click();
  await expect(
    page.getByRole("heading", { name: "A little closer to home." }),
  ).toBeVisible();
  await expect(page.getByLabel("Long-lived access token")).toHaveValue("");
});
