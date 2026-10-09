import { connectionUrl } from "./connection.mjs";

export const REDIRECT_URI = "glow-lighting://auth/callback";
export const DEFAULT_CLIENT_ID =
  "https://schachfeld.github.io/easy-mode-lighting/";
export const LOGIN_LIFETIME = 10 * 60 * 1000;

export function createLogin(
  baseUrl,
  clientId = DEFAULT_CLIENT_ID,
  now = Date.now(),
) {
  const client = new URL(clientId);
  if (
    client.protocol !== "https:" ||
    client.username ||
    client.password ||
    client.hash ||
    client.search
  )
    throw new Error("Glow’s login identity must be an HTTPS website address.");
  return {
    url: connectionUrl(baseUrl),
    clientId: client.href,
    redirectUri: REDIRECT_URI,
    state: Array.from(
      globalThis.crypto.getRandomValues(new Uint8Array(32)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join(""),
    createdAt: now,
  };
}

export function authorizeUrl(login) {
  const url = new URL("auth/authorize", login.url);
  url.search = new URLSearchParams({
    client_id: login.clientId,
    redirect_uri: login.redirectUri,
    state: login.state,
    response_type: "code",
  }).toString();
  return url.href;
}

export function isLoginCallback(value) {
  try {
    const url = new URL(value);
    return (
      `${url.protocol}//${url.host}${url.pathname}` === REDIRECT_URI &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function callbackCode(value, login, now = Date.now()) {
  if (!isLoginCallback(value))
    throw new Error("This is not a Glow login callback.");
  if (
    !login ||
    login.redirectUri !== REDIRECT_URI ||
    typeof login.state !== "string" ||
    login.state.length !== 64 ||
    !Number.isFinite(login.createdAt) ||
    now - login.createdAt > LOGIN_LIFETIME ||
    login.createdAt > now
  )
    throw new Error("This sign-in has expired. Please sign in again.");
  const params = new URL(value).searchParams;
  if (
    params.getAll("state").length !== 1 ||
    params.get("state") !== login.state
  )
    throw new Error(
      "The sign-in response did not match this app. Please try again.",
    );
  if (params.has("error"))
    throw new Error(
      "Home Assistant did not authorize Glow. Please sign in again.",
    );
  if (params.getAll("code").length !== 1 || !params.get("code"))
    throw new Error(
      "Home Assistant did not return a sign-in code. Please try again.",
    );
  return params.get("code");
}

export function tokenProvider(connection, request, initialGrant) {
  let initial = initialGrant;
  let inFlight;
  return async () => {
    if ("token" in connection) return connection.token;
    // Use the code exchange grant once. Every new socket then obtains a fresh
    // access token, including after long background suspension or network loss.
    if (initial) {
      const grant = initial;
      initial = undefined;
      if (grant.expiresAt > Date.now() + 30000) return grant.accessToken;
    }
    if (!inFlight) {
      inFlight = request({
        baseUrl: connection.url,
        clientId: connection.clientId,
        grantType: "refresh_token",
        refreshToken: connection.refreshToken,
      })
        .then((grant) => grant.accessToken)
        .finally(() => {
          inFlight = undefined;
        });
    }
    return inFlight;
  };
}
