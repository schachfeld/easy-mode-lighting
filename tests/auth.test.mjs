import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createLogin,
  authorizeUrl,
  callbackCode,
  isLoginCallback,
  tokenProvider,
  REDIRECT_URI,
  LOGIN_LIFETIME,
} from "../packages/core/auth.mjs";

const callback = (pending, suffix = "code=once") =>
  `${REDIRECT_URI}?state=${pending.state}&${suffix}`;

test("account authorization uses the chosen instance, identity, callback and unpredictable state", () => {
  const login = createLogin("https://home.example/proxy");
  const url = new URL(authorizeUrl(login));
  assert.equal(
    url.origin + url.pathname,
    "https://home.example/proxy/auth/authorize",
  );
  assert.equal(
    url.searchParams.get("client_id"),
    "https://schachfeld.github.io/easy-mode-lighting/",
  );
  assert.equal(url.searchParams.get("redirect_uri"), REDIRECT_URI);
  assert.equal(url.searchParams.get("state"), login.state);
  assert.match(login.state, /^[0-9a-f]{64}$/);
  assert.notEqual(createLogin(login.url).state, login.state);
  assert.throws(() => createLogin(login.url, "http://untrusted.example"));
});

test("callbacks reject wrong destinations, mismatched or duplicate state, missing codes, denial and expiry", () => {
  const pending = createLogin("http://home.local:8123", undefined, 1000);
  assert.equal(callbackCode(callback(pending), pending, 1001), "once");
  assert.equal(
    isLoginCallback("https://evil.example/auth/callback?code=x"),
    false,
  );
  assert.equal(isLoginCallback("glow-lighting://auth/other?code=x"), false);
  assert.equal(
    isLoginCallback("glow-lighting://user@auth/callback?code=x"),
    false,
  );
  for (const url of [
    callback(pending).replace(pending.state, "wrong"),
    callback(pending, "state=other&code=once"),
    callback(pending, "code=a&code=b"),
    callback(pending, "error=access_denied"),
    callback(pending, ""),
  ])
    assert.throws(() => callbackCode(url, pending, 1001));
  assert.throws(
    () => callbackCode(callback(pending), pending, 1001 + LOGIN_LIFETIME),
    /expired/,
  );
  assert.throws(() => callbackCode(callback(pending), pending, 0), /expired/);
});

test("the first socket can use the code grant; reconnections renew access with the same client id", async () => {
  const requests = [];
  const connection = {
    url: "https://home.example/",
    clientId: "https://glow.example/",
    refreshToken: "refresh-secret",
  };
  const getToken = tokenProvider(
    connection,
    async (request) => {
      requests.push(request);
      return { accessToken: "renewed" };
    },
    { accessToken: "initial", expiresAt: Date.now() + 60000 },
  );
  assert.equal(await getToken(), "initial");
  const renewed = await Promise.all([getToken(), getToken()]);
  assert.deepEqual(renewed, ["renewed", "renewed"]);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], {
    baseUrl: connection.url,
    clientId: connection.clientId,
    grantType: "refresh_token",
    refreshToken: connection.refreshToken,
  });
});

test("expired grants renew immediately; transient failures can retry and legacy tokens still work", async () => {
  let attempts = 0;
  const getToken = tokenProvider(
    { url: "http://home/", clientId: "https://glow/", refreshToken: "refresh" },
    async () => {
      if (++attempts === 1) throw new Error("Offline");
      return { accessToken: "fresh" };
    },
    { accessToken: "expired", expiresAt: 0 },
  );
  await assert.rejects(getToken(), /Offline/);
  assert.equal(await getToken(), "fresh");
  assert.equal(
    await tokenProvider({ url: "http://home/", token: "legacy" }, () => {
      throw new Error("Should not refresh");
    })(),
    "legacy",
  );
});

test("identity metadata and native scheme agree and declare the callback within the first 10kB", () => {
  const page = readFileSync(
    new URL("../auth-client/index.html", import.meta.url),
    "utf8",
  );
  assert.ok(
    page.slice(0, 10000).includes(`rel="redirect_uri" href="${REDIRECT_URI}"`),
  );
  assert.ok(!page.includes("<script"));
  const config = JSON.parse(
    readFileSync(
      new URL("../src-tauri/tauri.conf.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(
    config.plugins["deep-link"].mobile[0].scheme.includes(
      new URL(REDIRECT_URI).protocol.slice(0, -1),
    ),
  );
});
