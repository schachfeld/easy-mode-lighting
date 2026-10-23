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
const requestTimeoutMs = 20000;
// The server sends a heartbeat every 20 seconds.
const silenceTimeoutMs = 50000;
const interrupted = "Connection interrupted. Reconnecting automatically…";

async function fetchCommand(method: string, path: string, body: object) {
  const response = await fetch(endpoint(path), {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Something went wrong. Please try again.");
  return result;
}

function streamEvents(
  onHome: (home: Home) => void,
  onError: (message: string) => void,
) {
  const events = new EventSource(endpoint("events"));
  events.onmessage = (event) => {
    try {
      onHome(JSON.parse(event.data));
    } catch {
      onError("Glow received an unexpected response. Refresh to try again.");
    }
  };
  events.onerror = () => onError(interrupted);
  return () => events.close();
}

// One WebSocket carries live state and commands. If a proxy never lets it
// open, Glow falls back to server-sent events and HTTP requests.
export function createServerClient(): GlowClient {
  type Pending = {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: number;
  };
  let socket: WebSocket | null = null;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  function rejectPending() {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(
        new Error("Connection interrupted. Check your lights and try again."),
      );
    }
    pending.clear();
  }

  return {
    sceneStorage: "server",
    subscribe(onHome, onError) {
      let stopped = false;
      let everOpened = false;
      let failures = 0;
      let retryTimer = 0;
      let silenceTimer = 0;
      let fallback: (() => void) | null = null;

      const listen = () => {
        clearTimeout(silenceTimer);
        silenceTimer = window.setTimeout(
          () => socket?.close(),
          silenceTimeoutMs,
        );
      };
      const connect = () => {
        clearTimeout(retryTimer);
        if (stopped || socket) return;
        const url = new URL(endpoint("websocket"));
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const current = new WebSocket(url);
        socket = current;
        current.onopen = () => {
          everOpened = true;
          failures = 0;
          listen();
        };
        current.onmessage = (event) => {
          listen();
          let message;
          try {
            message = JSON.parse(event.data);
          } catch {
            return onError(
              "Glow received an unexpected response. Refresh to try again.",
            );
          }
          if (message.type === "state") onHome(message.home);
          if (message.type === "result") {
            const request = pending.get(message.id);
            if (!request) return;
            clearTimeout(request.timer);
            pending.delete(message.id);
            if (message.error) request.reject(new Error(message.error));
            else request.resolve(message.result);
          }
        };
        current.onclose = () => {
          clearTimeout(silenceTimer);
          if (socket !== current) return;
          socket = null;
          rejectPending();
          if (stopped) return;
          onError(interrupted);
          failures += 1;
          if (!everOpened && failures >= 2) {
            fallback = streamEvents(onHome, onError);
            return;
          }
          retryTimer = window.setTimeout(
            connect,
            Math.min(10000, 500 * 2 ** Math.min(failures, 5)),
          );
        };
      };
      // Browsers pause background tabs and phones drop sockets while asleep.
      // Reconnect at once when Glow is visible or the network returns.
      const wake = () => {
        if (document.visibilityState !== "visible" || fallback) return;
        if (socket?.readyState === WebSocket.OPEN) listen();
        else if (!socket) connect();
      };
      document.addEventListener("visibilitychange", wake);
      window.addEventListener("online", wake);
      connect();
      return () => {
        stopped = true;
        clearTimeout(retryTimer);
        clearTimeout(silenceTimer);
        document.removeEventListener("visibilitychange", wake);
        window.removeEventListener("online", wake);
        fallback?.();
        const current = socket;
        socket = null;
        current?.close();
        rejectPending();
      };
    },
    execute(method, path, body) {
      const current = socket;
      if (current?.readyState !== WebSocket.OPEN)
        return fetchCommand(method, path, body);
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          pending.delete(id);
          reject(new Error("Glow took too long to respond. Please try again."));
        }, requestTimeoutMs);
        pending.set(id, { resolve, reject, timer });
        current.send(JSON.stringify({ id, method, path, body }));
      });
    },
  };
}

export const serverClient = createServerClient();
