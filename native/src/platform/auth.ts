import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import {
  authorizeUrl,
  callbackCode,
  createLogin,
  isLoginCallback,
  type AccessGrant,
  type OAuthConnection,
  type PendingLogin,
} from "../core";
import { requestToken } from "./http";

// Account sign-in happens on Home Assistant's own page in the system browser.
// Home Assistant then opens glow-lighting://auth/callback, which brings Glow
// back. The pending sign-in is stored, so it survives Glow being closed by
// the system while the browser is open.
const pendingKey = "pending-login";

let operation: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const result = operation.then(task);
  operation = result.catch(() => {});
  return result;
}

export function cancelLogin() {
  return serialized(() => AsyncStorage.removeItem(pendingKey));
}

export async function beginLogin(url: string) {
  const login = createLogin(
    url,
    process.env.EXPO_PUBLIC_HA_CLIENT_ID || undefined,
  );
  await serialized(async () => {
    await AsyncStorage.setItem(pendingKey, JSON.stringify(login));
    try {
      await Linking.openURL(authorizeUrl(login));
    } catch {
      await AsyncStorage.removeItem(pendingKey);
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
    const raw = await AsyncStorage.getItem(pendingKey);
    // Replayed callbacks, such as the launch link after a handled event, do nothing.
    if (!raw) return null;
    let pending: PendingLogin | null = null;
    try {
      pending = JSON.parse(raw);
    } catch {
      // callbackCode reports an expired sign-in.
    }
    const code = callbackCode(url, pending);
    // Consume before exchanging: codes and matching callbacks may only be used once.
    await AsyncStorage.removeItem(pendingKey);
    const grant = await requestToken({
      baseUrl: pending!.url,
      clientId: pending!.clientId,
      grantType: "authorization_code",
      code,
    });
    if (!grant.refreshToken)
      throw new Error(
        "Home Assistant did not return a renewable sign-in. Please try again.",
      );
    return {
      connection: {
        url: pending!.url,
        clientId: pending!.clientId,
        refreshToken: grant.refreshToken,
      },
      grant,
    };
  });
}

export function listenForLogin(
  onAccount: (account: AuthorizedAccount) => void,
  onError: (message: string) => void,
) {
  let active = true;
  const receive = async (url: string | null) => {
    if (!url || !active) return;
    try {
      const account = await completeLogin(url);
      if (active && account) onAccount(account);
    } catch (error) {
      if (active)
        onError(
          error instanceof Error
            ? error.message
            : "Sign-in failed. Please try again.",
        );
    }
  };
  const subscription = Linking.addEventListener("url", ({ url }) => {
    void receive(url);
  });
  // Glow may have been started by the callback itself.
  Linking.getInitialURL()
    .then(receive)
    .catch(() =>
      onError("Could not receive the sign-in callback. Please try again."),
    );
  return () => {
    active = false;
    subscription.remove();
  };
}
