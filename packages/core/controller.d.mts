import type { Home, Scene } from "./types";
import type { HomeAssistant } from "./home-assistant.mjs";
export interface SceneData {
  scenes: Scene[];
  favorites: Record<string, boolean>;
}
export interface SceneStore {
  data: SceneData;
  save(data: SceneData): void | Promise<void>;
}
export interface GlowCore {
  state(): Home;
  subscribe(callback: (home: Home) => void): () => void;
  execute(method: string, path: string, body?: object): Promise<unknown>;
  close(): void;
}
export function createCore(options: {
  ha?: HomeAssistant | null;
  store: SceneStore;
  randomUUID?: () => string;
}): GlowCore;
