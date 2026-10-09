import { test, expect, type Page } from "@playwright/test";
import { nativeHost } from "./native-host";

async function startLogin(page: Page) {
  await page
    .getByLabel("Home Assistant address")
    .fill("https://home.example/ha/");
  await page
    .getByRole("button", { name: "Sign in with Home Assistant", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Finish signing in");
  return page.evaluate(() => {
    const url = new URL((window as any).__browserUrl);
    return {
      state: url.searchParams.get("state"),
      callback: url.searchParams.get("redirect_uri"),
      clientId: url.searchParams.get("client_id"),
      path: url.pathname,
    };
  });
}

async function callback(page: Page, url: string) {
  await page.evaluate((value) => (window as any).__deepLink(value), url);
}

test("account sign-in opens HA, validates callback, stores only the renewable credential and refreshes on reconnect", async ({
  page,
}) => {
  await nativeHost(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mobile/");
  await expect(
    page.getByRole("button", {
      name: "Sign in with Home Assistant",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(page.getByLabel("Long-lived access token")).not.toBeVisible();
  await page.screenshot({
    path: "artifacts/glow-account-login.png",
    fullPage: true,
  });
  const login = await startLogin(page);
  expect(login.clientId).toBe(
    "https://schachfeld.github.io/easy-mode-lighting/",
  );
  expect(login.path).toBe("/ha/auth/authorize");
  const returnUrl = `${login.callback}?state=${login.state}&code=one-time-code`;
  await callback(page, returnUrl);
  await expect(
    page.getByRole("heading", { name: "You’re signed in." }),
  ).toBeVisible();
  await callback(page, returnUrl); // OS/browser duplicate delivery must not reuse a code.
  expect(
    await page.evaluate(() => (window as any).__tokenRequests.length),
  ).toBe(1);
  await page.getByLabel("Remember this connection").check();
  await page
    .getByLabel("Create a vault passphrase")
    .fill("correct horse battery staple");
  await page
    .getByLabel("Confirm passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Open my home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Object.values(localStorage).join(" ")),
  ).not.toContain("account-refresh-secret");
  expect(
    await page.evaluate(() => Object.values(localStorage).join(" ")),
  ).not.toContain("account-access-");
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect
    .poll(() => page.evaluate(() => (window as any).__tokenRequests.length))
    .toBe(2);
  expect(await page.evaluate(() => (window as any).__tokenRequests[1])).toEqual(
    {
      baseUrl: "https://home.example/ha/",
      clientId: login.clientId,
      grantType: "refresh_token",
      refreshToken: "account-refresh-secret",
    },
  );
  await expect(
    page.getByRole("button", { name: "Home Assistant connected" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /connected/ }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page
    .getByLabel("Vault passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Unlock & connect" }).click();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__tokenRequests.at(-1).grantType),
  ).toBe("refresh_token");
});

test("login callback survives a process restart without persisting credentials", async ({
  page,
}) => {
  await nativeHost(page);
  await page.goto("/mobile/");
  const login = await startLogin(page);
  await page.evaluate(
    (url) => sessionStorage.setItem("test-startup-link", url),
    `${login.callback}?state=${login.state}&code=restart-code`,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "You’re signed in." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__tokenRequests[0].code),
  ).toBe("restart-code");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("test-native-pending")!),
    ),
  ).toEqual({});
  await page.getByRole("button", { name: "Open my home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
});

test("wrong-state callbacks and callbacks after cancellation never exchange a code", async ({
  page,
}) => {
  await nativeHost(page);
  await page.goto("/mobile/");
  const login = await startLogin(page);
  await callback(page, `${login.callback}?state=wrong&code=attacker-code`);
  await expect(page.getByRole("alert")).toContainText("did not match");
  expect(
    await page.evaluate(() => (window as any).__tokenRequests.length),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Sign in with Home Assistant", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Finish signing in");
  const next = await page.evaluate(() =>
    new URL((window as any).__browserUrl).searchParams.get("state"),
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Sign in with Home Assistant",
      exact: true,
    }),
  ).toBeEnabled();
  await callback(page, `${login.callback}?state=${next}&code=cancelled-code`);
  expect(
    await page.evaluate(() => (window as any).__tokenRequests.length),
  ).toBe(0);
  await expect(
    page.getByRole("heading", { name: "You’re signed in." }),
  ).not.toBeVisible();
});

test("a revoked refresh token stops reconnecting and asks for sign-in", async ({
  page,
}) => {
  await nativeHost(page);
  await page.goto("/mobile/");
  const login = await startLogin(page);
  await callback(
    page,
    `${login.callback}?state=${login.state}&code=one-time-code`,
  );
  await page.getByRole("button", { name: "Open my home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as any).__reauthenticate = true;
    window.dispatchEvent(new Event("online"));
  });
  await expect(
    page.getByText(
      "Your Home Assistant sign-in is no longer valid. Please sign in again.",
    ),
  ).toBeVisible();
  const count = await page.evaluate(
    () => (window as any).__tokenRequests.length,
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  expect(
    await page.evaluate(() => (window as any).__tokenRequests.length),
  ).toBe(count);
});
