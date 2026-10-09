import type { Home } from "../types";

export interface GlowClient {
  sceneStorage: "server" | "device";
  subscribe(
    onHome: (home: Home) => void,
    onError: (message: string) => void,
  ): () => void;
  execute(method: string, path: string, body: object): Promise<unknown>;
}

const endpoint = (path: string) =>
  new URL(`api/${path}`, new URL(".", window.location.href)).href;

export const serverClient: GlowClient = {
  sceneStorage: "server",
  subscribe(onHome, onError) {
    const events = new EventSource(endpoint("events"));
    events.onmessage = (event) => {
      try {
        onHome(JSON.parse(event.data));
      } catch {
        onError("Glow received an unexpected response. Refresh to try again.");
      }
    };
    events.onerror = () =>
      onError("Connection interrupted. Reconnecting automatically…");
    return () => events.close();
  },
  async execute(method, path, body) {
    const response = await fetch(endpoint(path), {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error ?? "Something went wrong. Please try again.",
      );
    return result;
  },
};
