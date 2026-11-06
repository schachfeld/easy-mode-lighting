import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  connectionUrl,
  createCore,
  HomeAssistant,
  tokenProvider,
  websocketUrl,
  type AccessGrant,
  type Connection,
  type GlowCore,
  type SceneData,
  type Home,
} from "../core";
import { createDemo } from "../../../packages/core/model.mjs";
import { requestToken, sceneRequest } from "./http";
import { createSocket } from "./socket";
import { sceneStore } from "./storage";

export interface GlowClient {
  mode: "live" | "demo";
  subscribe(onHome: (home: Home) => void): () => void;
  execute(method: string, path: string, body?: object): Promise<unknown>;
  close(): void;
}

const wrap = (core: GlowCore, mode: GlowClient["mode"], close: () => void) => ({
  mode,
  subscribe: (onHome: (home: Home) => void) => core.subscribe(onHome),
  execute: (method: string, path: string, body?: object) =>
    core.execute(method, path, body),
  close,
});

// Connects straight to Home Assistant; no Glow add-on or server is needed.
export async function connect(
  connection: Connection,
  signal: AbortSignal,
  initialGrant?: AccessGrant,
): Promise<GlowClient> {
  const url = connectionUrl(connection.url);
  const store = await sceneStore(url);
  if (signal.aborted) throw new Error("Connection cancelled.");
  const ha = new HomeAssistant({
    url: websocketUrl(url),
    apiUrl: new URL("api/", url).href,
    sceneRequest,
    getToken: tokenProvider(connection, requestToken, initialGrant),
    timeoutMs: 25000,
    createSocket,
  });
  const core = createCore({ ha, store });
  const abort = () => {
    ha.stop();
    core.close();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          finish(
            new Error(
              "Cannot connect. Check your address, network, and sign-in.",
            ),
          ),
        40000,
      );
      const check = () => {
        if (ha.connected) finish();
        // A stopped client was refused for good, such as a revoked sign-in.
        else if (ha.error)
          finish(
            Object.assign(new Error(ha.error), { reauthenticate: ha.stopped }),
          );
      };
      const cancel = () => finish(new Error("Connection cancelled."));
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        ha.off("change", check);
        signal.removeEventListener("abort", cancel);
        if (error) reject(error);
        else resolve();
      };
      signal.addEventListener("abort", cancel, { once: true });
      ha.on("change", check);
      ha.start();
    });
  } catch (error) {
    abort();
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
  }
  // Phones suspend sockets in the background. Reconnect on returning to Glow,
  // and when the network comes back.
  let state: string = AppState.currentState ?? "active";
  const appState = AppState.addEventListener("change", (next) => {
    if (state.match(/inactive|background/) && next === "active") ha.reconnect();
    state = next;
  });
  let online: boolean | null = null;
  const network = NetInfo.addEventListener(({ isConnected }) => {
    if (online === false && isConnected) ha.reconnect();
    online = isConnected;
  });
  return wrap(core, "live", () => {
    appState.remove();
    network();
    abort();
  });
}

// A demo home with the web app's sample rooms. It never touches real lights.
export async function connectDemo(): Promise<GlowClient> {
  const store = await sceneStore(
    "demo",
    "demo-home",
    createDemo() as unknown as SceneData,
  );
  const core = createCore({ store });
  return wrap(core, "demo", () => core.close());
}
