import { test, expect, type Page } from "@playwright/test";
import { DEFAULT_CLIENT_ID } from "../../packages/core/auth.mjs";
import { HomeAssistantClient, owner, resetLights } from "./home-assistant";
import { nativeHost } from "./native-host";

const ha = new HomeAssistantClient(
  process.env.GLOW_HA_URL!,
  process.env.GLOW_HA_TOKEN!,
);

type RefreshToken = { id: string; client_id: string | null; type: string };
const glowTokens = async () =>
  ((await ha.ws("auth/refresh_tokens")) as RefreshToken[]).filter(
    (token) => token.client_id === DEFAULT_CLIENT_ID,
  );

test.beforeEach(async () => {
  await resetLights(ha);
  for (const token of await glowTokens())
    await ha.ws("auth/delete_refresh_token", { refresh_token_id: token.id });
});

// Signs in the way a person would: the app opens Home Assistant's own login
// page in the browser, and the browser hands the callback back to the app.
async function signIn(page: Page) {
  const host = await nativeHost(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(process.env.GLOW_MOBILE_URL!);
  await page.getByLabel("Home Assistant address").fill(ha.url);
  await page
    .getByRole("button", { name: "Sign in with Home Assistant", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Finish signing in");
  const authorize: string = await page.evaluate(
    () => (window as any).__browserUrl,
  );
  expect(authorize.startsWith(new URL("auth/authorize", ha.url).href)).toBe(
    true,
  );

  const browser = await page.context().newPage();
  const callback = browser.waitForRequest((request) =>
    request.url().startsWith("glow-lighting://"),
  );
  await browser.goto(authorize);
  await expect(
    browser.getByText(`You're about to give ${DEFAULT_CLIENT_ID} access`),
  ).toBeVisible();
  await browser.getByRole("textbox", { name: "Username" }).fill(owner.username);
  await browser.getByRole("textbox", { name: "Password" }).fill(owner.password);
  await browser.getByRole("button", { name: "Log in" }).click();
  const rejected = browser
    .getByText("Invalid redirect URI")
    .waitFor()
    .then(
      () => {
        throw new Error(
          "Home Assistant rejected Glow's callback. Check auth-client/index.html.",
        );
      },
      // Closing the login page ends the wait; the callback already won.
      () => new Promise<never>(() => {}),
    );
  const returned = (await Promise.race([callback, rejected])).url();
  await browser.close();
  expect(returned).toMatch(/^glow-lighting:\/\/auth\/callback\?code=/);

  await page.evaluate((url) => (window as any).__deepLink(url), returned);
  await expect(
    page.getByRole("heading", { name: "You’re signed in." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open my home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  return host;
}

test("account sign-in through Home Assistant's login page connects the app and renews access", async ({
  page,
}) => {
  const { exchanges } = await signIn(page);
  expect(exchanges).toHaveLength(1);
  const [login] = exchanges;
  expect(login.request.grantType).toBe("authorization_code");
  expect(login.status).toBe(200);
  expect(login.body).toMatchObject({ token_type: "Bearer" });
  expect(await glowTokens()).toHaveLength(1);
  // Only the renewable credential is kept, and only in secure storage.
  expect(
    JSON.parse(await page.evaluate(() => (window as any).__keychain())),
  ).toEqual({
    url: ha.url,
    clientId: DEFAULT_CLIENT_ID,
    refreshToken: login.body!.refresh_token,
  });

  const room = page.getByRole("switch", {
    name: "Living room lights",
    exact: true,
  });
  await room.click();
  await expect
    .poll(async () => (await ha.state("light.sofa_lamp")).state)
    .toBe("off");

  // Reconnecting asks Home Assistant for a fresh access token.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => exchanges.length).toBe(2);
  expect(exchanges[1]).toMatchObject({
    request: {
      grantType: "refresh_token",
      refreshToken: login.body!.refresh_token,
    },
    status: 200,
  });
  await expect(
    page.getByRole("button", { name: "Home Assistant connected" }),
  ).toBeVisible();
  await room.click();
  await expect
    .poll(async () => (await ha.state("light.sofa_lamp")).state)
    .toBe("on");

  // Restarting the app signs straight back in with the saved credential.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  expect(exchanges.at(-1)).toMatchObject({
    request: { grantType: "refresh_token" },
    status: 200,
  });
  expect(await glowTokens()).toHaveLength(1);
});

test("revoking Glow in Home Assistant makes the app ask to sign in again", async ({
  page,
}) => {
  const { exchanges } = await signIn(page);
  const [token] = await glowTokens();
  // Home Assistant drops the app's connection itself; the app then finds its
  // saved credential rejected.
  await ha.ws("auth/delete_refresh_token", { refresh_token_id: token.id });
  await expect(
    page.getByText(
      "Your Home Assistant sign-in is no longer valid. Please sign in again.",
    ),
  ).toBeVisible();
  expect(exchanges.at(-1)).toMatchObject({
    request: { grantType: "refresh_token" },
    status: 400,
  });
  // A rejected sign-in is final: going back online does not retry it.
  const count = exchanges.length;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(1000);
  expect(exchanges).toHaveLength(count);
  // At the next launch, the rejected credential is forgotten.
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Your Home Assistant sign-in is no longer valid.",
  );
  await expect(
    page.getByRole("button", {
      name: "Sign in with Home Assistant",
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__keychain())).toBeNull();
});

test("Home Assistant refuses callbacks that Glow's identity page does not declare", async ({
  page,
}) => {
  const url = new URL("auth/authorize", ha.url);
  url.search = new URLSearchParams({
    client_id: DEFAULT_CLIENT_ID,
    redirect_uri: "glow-lighting://somewhere/else",
    state: "x",
    response_type: "code",
  }).toString();
  const redirects: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("glow-lighting://"))
      redirects.push(request.url());
  });
  await page.goto(url.href);
  await page.getByRole("textbox", { name: "Username" }).fill(owner.username);
  await page.getByRole("textbox", { name: "Password" }).fill(owner.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Invalid redirect URI")).toBeVisible();
  expect(redirects).toEqual([]);
});
