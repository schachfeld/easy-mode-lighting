import { load } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { Stronghold } from "@tauri-apps/plugin-stronghold";
import type { SceneData, SceneStore } from "../../packages/core/controller.mjs";

import type { Connection } from "../../packages/core/auth.mjs";
export type { Connection } from "../../packages/core/auth.mjs";
export const hasSavedConnection = () => invoke<boolean>("has_saved_connection");
export const forgetConnection = () => invoke<void>("forget_connection");

async function withVault<T>(
  password: string,
  action: (vault: Stronghold) => Promise<T>,
) {
  const path = await join(await appLocalDataDir(), "connection.hold");
  const vault = await Stronghold.load(path, password);
  try {
    return await action(vault);
  } finally {
    await vault.unload();
  }
}

export async function saveConnection(connection: Connection, password: string) {
  if (password.length < 12)
    throw new Error("Use at least 12 characters for your vault passphrase.");
  await withVault(password, async (vault) => {
    const client = await vault.createClient("glow");
    await client
      .getStore()
      .insert(
        "connection",
        Array.from(new TextEncoder().encode(JSON.stringify(connection))),
      );
    await vault.save();
  });
}

export async function unlockConnection(password: string): Promise<Connection> {
  return withVault(password, async (vault) => {
    const client = await vault.loadClient("glow");
    const value = await client.getStore().get("connection");
    if (!value) throw new Error("No connection saved.");
    const connection = JSON.parse(
      new TextDecoder().decode(new Uint8Array(value)),
    );
    if (
      typeof connection.url !== "string" ||
      !(
        typeof connection.token === "string" ||
        (typeof connection.refreshToken === "string" &&
          typeof connection.clientId === "string")
      )
    )
      throw new Error("Invalid saved connection.");
    return connection;
  });
}

export async function sceneStore(url: string): Promise<SceneStore> {
  const disk = await load("scenes.json", { autoSave: false, defaults: {} });
  const data = (await disk.get<SceneData>(url)) ?? {
    scenes: [],
    favorites: {},
  };
  if (
    !Array.isArray(data.scenes) ||
    !data.favorites ||
    typeof data.favorites !== "object"
  )
    throw new Error(
      "Saved scenes could not be read. Restore your app data before continuing.",
    );
  return {
    data,
    async save(this: SceneStore, next) {
      const previous = this.data;
      try {
        await disk.set(url, next);
        await disk.save();
        this.data = next;
      } catch {
        await disk.set(url, previous);
        throw new Error(
          "Could not save your scenes. Check the device’s available storage.",
        );
      }
    },
  };
}
