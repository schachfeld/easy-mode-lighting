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

test("mobile connects directly, stays signed in, persists scenes per home and disconnects", async ({
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
  // The sign-in lives in the device's secure storage, not the web view.
  expect(
    JSON.parse(await page.evaluate(() => (window as any).__keychain())),
  ).toEqual({ url: "http://homeassistant.local:8123/", token: "test-token" });
  // Reopening the app goes straight back home, without signing in again.
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Activate Mobile evening in Living room",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /connected/ }).click();
  await expect(
    page.getByText("Scenes are saved in Home Assistant.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  // A disconnected app waits instead of reconnecting on its own.
  await expect(
    page.getByRole("heading", { name: "Welcome home." }),
  ).toBeVisible();
  await expect(
    page.getByText("signed in to homeassistant.local:8123"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open my home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /connected/ }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page.getByRole("button", { name: "Forget saved connection" }).click();
  await expect(
    page.getByRole("heading", { name: "A little closer to home." }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__keychain())).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little closer to home." }),
  ).toBeVisible();
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
    page
      .getByRole("dialog")
      .getByText(
        "Could not save your changes. Check the device’s available storage.",
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

test("without secure storage, remembered credentials use the passphrase vault, unlock errors are recoverable, and forgetting returns to setup", async ({
  page,
}) => {
  await nativeHost(page, { secureStorage: false });
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

test("mobile publishes persistent Home Assistant scenes and preserves the editor on permission errors", async ({
  page,
}) => {
  await nativeHost(page);
  await page.goto("/mobile/");
  await connect(page);
  await page
    .getByRole("button", { name: "Open Living room", exact: true })
    .click();
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await page.getByLabel("Scene name", { exact: true }).fill("Shared evening");
  await page.evaluate(() => {
    (window as any).__sceneStatus = 403;
  });
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "administrator",
  );
  await expect(page.getByLabel("Scene name", { exact: true })).toHaveValue(
    "Shared evening",
  );
  await page.evaluate(() => {
    (window as any).__sceneStatus = 200;
  });
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const activate = page.getByRole("button", {
    name: "Activate Shared evening in Living room",
    exact: true,
  });
  await expect(activate).toHaveCount(1);
  const saved = await page.evaluate(() =>
    (window as any).__sceneRequests.at(-1),
  );
  expect(saved.url).toMatch(/\/api\/config\/scene\/config\/glow_/);
  expect(saved.token).toBe("test-token");
  expect(saved.body.entities["light.floor"].state).toBe("on");
  await activate.click();
  expect(
    await page.evaluate(() => (window as any).__nativeCalls.at(-1).service),
  ).toBe("turn_on");
  await page
    .getByRole("button", { name: "Edit Shared evening", exact: true })
    .click();
  await page.getByLabel("Scene name", { exact: true }).fill("Renamed evening");
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__sceneRequests.at(-1).url),
  ).toBe(saved.url);
  // Clearing Glow's local metadata does not remove the HA scene.
  await page.evaluate(() => localStorage.removeItem("test-native-scenes"));
  // The app reconnects on its own with the saved sign-in.
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Activate Renamed evening in Living room",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Edit Renamed evening", exact: true }),
  ).toHaveCount(0);
});

test("unlocking a passphrase vault once moves the sign-in to secure storage", async ({
  page,
}) => {
  const connection = {
    url: "http://homeassistant.local:8123/",
    token: "test-token",
  };
  await nativeHost(page, {
    vault: { password: "correct horse battery staple", connection },
  });
  await page.goto("/mobile/");
  await expect(
    page.getByRole("heading", { name: "Welcome home." }),
  ).toBeVisible();
  await expect(
    page.getByText("You won’t need the passphrase again"),
  ).toBeVisible();
  await page
    .getByLabel("Vault passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Unlock & connect" }).click();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  expect(
    JSON.parse(await page.evaluate(() => (window as any).__keychain())),
  ).toEqual(connection);
  // The vault is gone, and the next launch needs no passphrase.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Vault passphrase")).toHaveCount(0);
});

test("turning off Stay signed in keeps the sign-in for this session only", async ({
  page,
}) => {
  await nativeHost(page);
  await page.goto("/mobile/");
  await page
    .getByRole("button", { name: "Use an access token instead" })
    .click();
  await page.getByLabel("Long-lived access token").fill("test-token");
  await page.getByLabel("Stay signed in on this device").uncheck();
  await page.getByRole("button", { name: "Connect to my home" }).click();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__keychain())).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little closer to home." }),
  ).toBeVisible();
});

test("a saved sign-in that cannot be read asks to sign in again", async ({
  page,
}) => {
  await nativeHost(page);
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "test-native-keychain",
      JSON.stringify({ url: "http://homeassistant.local:8123/", token: "x" }),
    );
    sessionStorage.setItem("test-keychain-unreadable", "1");
  });
  await page.goto("/mobile/");
  await expect(page.getByRole("alert")).toContainText(
    "could not read your saved sign-in",
  );
  await expect(
    page.getByRole("heading", { name: "A little closer to home." }),
  ).toBeVisible();
});
