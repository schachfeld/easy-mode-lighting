import { HomeAssistant } from "../../packages/core/home-assistant.mjs";
import { createCore } from "../../packages/core/controller.mjs";
import {
  connectionUrl,
  websocketUrl,
} from "../../packages/core/connection.mjs";
import type { GlowClient } from "../platform/client";
import { createSocket } from "./native";
import { sceneStore, type Connection } from "./storage";

export interface MobileClient extends GlowClient {
  close(): void;
}

export async function connectMobile(
  connection: Connection,
  signal: AbortSignal,
): Promise<MobileClient> {
  const url = connectionUrl(connection.url);
  const store = await sceneStore(url);
  if (signal.aborted) throw new Error("Connection cancelled.");
  const ha = new HomeAssistant({
    url: websocketUrl(url),
    token: connection.token.trim(),
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
      const timeout = window.setTimeout(
        () =>
          finish(
            new Error(
              "Cannot connect. Check your address, network, and access token.",
            ),
          ),
        20000,
      );
      const check = () => {
        if (ha.connected) finish();
        else if (ha.error) finish(new Error(ha.error));
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
  // Mobile operating systems suspend background sockets. Refresh when returning.
  const resume = () => {
    if (document.visibilityState === "visible") ha.reconnect();
  };
  const online = () => ha.reconnect();
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("online", online);
  return {
    sceneStorage: "device",
    subscribe: (onHome) => core.subscribe(onHome),
    execute: (method, path, body) => core.execute(method, path, body),
    close() {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", online);
      abort();
    },
  };
}
