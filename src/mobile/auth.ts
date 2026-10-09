import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { load } from "@tauri-apps/plugin-store";
import {
  authorizeUrl,
  callbackCode,
  createLogin,
  isLoginCallback,
  type PendingLogin,
  type TokenRequest,
  type AccessGrant,
  type OAuthConnection,
} from "../../packages/core/auth.mjs";

export async function requestToken(
  request: TokenRequest,
): Promise<AccessGrant> {
  try {
    const response = await invoke<{
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    }>("ha_token_request", { request });
    if (
      !response.access_token ||
      !Number.isFinite(response.expires_in) ||
      response.expires_in <= 0
    )
      throw new Error("Home Assistant returned an invalid sign-in response.");
    return {
      accessToken: response.access_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      refreshToken: response.refresh_token,
    };
  } catch (cause) {
    const failure = cause as { message?: string; reauthenticate?: boolean };
    throw Object.assign(
      new Error(
        failure?.message ??
          "Could not reach Home Assistant to sign in. Please try again.",
      ),
      { reauthenticate: failure?.reauthenticate === true },
    );
  }
}

const pendingStore = () =>
  load("pending-login.json", { autoSave: false, defaults: {} });
let operation: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const result = operation.then(task);
  operation = result.catch(() => {});
  return result;
}

export function cancelLogin() {
  return serialized(async () => {
    const store = await pendingStore();
    await store.delete("pending");
    await store.save();
  });
}

export async function beginLogin(url: string) {
  const login = createLogin(
    url,
    import.meta.env.VITE_HA_CLIENT_ID || undefined,
  );
  await serialized(async () => {
    const store = await pendingStore();
    await store.set("pending", login);
    await store.save();
    try {
      await openUrl(authorizeUrl(login));
    } catch {
      await store.delete("pending");
      await store.save();
      throw new Error("Could not open your browser. Please try again.");
    }
  });
}

export interface AuthorizedAccount {
  connection: OAuthConnection;
  grant: AccessGrant;
}
export function completeLogin(url: string): Promise<AuthorizedAccount | null> {
  return serialized(async () => {
    if (!isLoginCallback(url)) return null;
    const store = await pendingStore();
    const pending = await store.get<PendingLogin>("pending");
    // Replayed callbacks, including getCurrent after a handled live event, do nothing.
    if (!pending) return null;
    const code = callbackCode(url, pending);
    // Consume before exchanging: codes and matching callbacks may only be used once.
    await store.delete("pending");
    await store.save();
    const grant = await requestToken({
      baseUrl: pending.url,
      clientId: pending.clientId,
      grantType: "authorization_code",
      code,
    });
    if (!grant.refreshToken)
      throw new Error(
        "Home Assistant did not return a renewable sign-in. Please try again.",
      );
    return {
      connection: {
        url: pending.url,
        clientId: pending.clientId,
        refreshToken: grant.refreshToken,
      },
      grant,
    };
  });
}

export async function listenForLogin(
  onAccount: (account: AuthorizedAccount) => void,
  onError: (message: string) => void,
  signal: AbortSignal,
) {
  let active = true;
  const receive = async (urls: string[]) => {
    for (const url of urls) {
      if (!active || signal.aborted) return;
      try {
        const account = await completeLogin(url);
        if (active && !signal.aborted && account) onAccount(account);
      } catch (error) {
        if (active && !signal.aborted)
          onError(
            error instanceof Error
              ? error.message
              : "Sign-in failed. Please try again.",
          );
      }
    }
  };
  const unlisten = await onOpenUrl((urls) => {
    void receive(urls);
  });
  if (signal.aborted) {
    unlisten();
    return () => {};
  }
  try {
    await receive((await getCurrent()) ?? []);
  } catch {
    onError("Could not receive the sign-in callback. Please try again.");
  }
  return () => {
    active = false;
    unlisten();
  };
}
