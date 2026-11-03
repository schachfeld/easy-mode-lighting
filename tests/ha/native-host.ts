import type { Page } from "@playwright/test";

export type TokenRequest = {
  baseUrl: string;
  clientId: string;
  grantType: "authorization_code" | "refresh_token";
  code?: string;
  refreshToken?: string;
};
export type TokenExchange = {
  request: TokenRequest;
  status: number;
  body: Record<string, any> | null;
};

// The mobile app's token exchange, as `ha_token_request` performs it in
// src-tauri/src/auth.rs: a form POST without redirects, where 400, 401 and 403
// mean the sign-in is no longer valid.
async function exchange(request: TokenRequest) {
  const endpoint = new URL(request.baseUrl);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/auth/token`;
  const credential =
    request.grantType === "authorization_code"
      ? { code: request.code! }
      : { refresh_token: request.refreshToken! };
  const response = await fetch(endpoint, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: request.grantType,
      client_id: request.clientId,
      ...credential,
    }),
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
}

// Stands in for the Tauri shell: deep links, the system browser, stores and
// secure storage stay in the page, while token requests and the WebSocket go to
// the real Home Assistant.
export async function nativeHost(page: Page) {
  const exchanges: TokenExchange[] = [];
  await page.exposeBinding(
    "__haTokenRequest",
    async (_source, request: TokenRequest) => {
      const result = await exchange(request);
      exchanges.push({ request, ...result });
      return result;
    },
  );
  await page.addInitScript(() => {
    const host = window as any;
    host.isTauri = true;
    let nextId = 1;
    const callbacks = new Map<number, Function>();
    const listeners = new Map<number, number>();
    const sockets = new Map<number, WebSocket>();
    // Session storage survives reloads, like app storage survives a restart.
    const stores = JSON.parse(sessionStorage.getItem("glow-stores") ?? "{}");
    const keychain = "glow-keychain";
    host.__keychain = () => sessionStorage.getItem(keychain);
    host.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: (_: string, id: number) => listeners.delete(id),
    };
    host.__deepLink = (url: string) => {
      for (const [id, handler] of listeners)
        callbacks.get(handler)?.({
          id,
          event: "deep-link://new-url",
          payload: [url],
        });
    };
    const storeNames: string[] = [];
    host.__TAURI_INTERNALS__ = {
      transformCallback: (callback: Function) => {
        const id = nextId++;
        callbacks.set(id, callback);
        return id;
      },
      unregisterCallback: (id: number) => callbacks.delete(id),
      invoke: async (command: string, args: any = {}) => {
        switch (command) {
          case "plugin:event|listen": {
            const id = nextId++;
            listeners.set(id, args.handler);
            return id;
          }
          case "plugin:event|unlisten":
            listeners.delete(args.eventId);
            return;
          case "plugin:deep-link|get_current":
            return null;
          case "plugin:opener|open_url":
            host.__browserUrl = args.url;
            return;
          case "ha_token_request": {
            const { status, body } = await host.__haTokenRequest(args.request);
            if ([400, 401, 403].includes(status))
              throw {
                message:
                  "Your Home Assistant sign-in is no longer valid. Please sign in again.",
                reauthenticate: true,
              };
            if (status !== 200)
              throw {
                message: "Home Assistant could not complete sign-in.",
                reauthenticate: false,
              };
            return body;
          }
          case "secure_storage_available":
            return true;
          case "has_saved_connection":
            return false;
          case "load_secure_connection":
            return sessionStorage.getItem(keychain);
          case "save_secure_connection":
            sessionStorage.setItem(keychain, args.connection);
            return;
          case "forget_connection":
            sessionStorage.removeItem(keychain);
            return;
          case "forget_vault":
            return;
          case "plugin:path|resolve_directory":
            return "/test/appdata";
          case "plugin:path|join":
            return args.paths.join("/");
          case "plugin:store|load":
            if (!storeNames.includes(args.path)) storeNames.push(args.path);
            return storeNames.indexOf(args.path) + 1;
          case "plugin:store|get": {
            const store = stores[storeNames[args.rid - 1]] ?? {};
            return [store[args.key], args.key in store];
          }
          case "plugin:store|set":
            (stores[storeNames[args.rid - 1]] ??= {})[args.key] = args.value;
            return;
          case "plugin:store|delete":
            delete stores[storeNames[args.rid - 1]]?.[args.key];
            return true;
          case "plugin:store|save":
            sessionStorage.setItem("glow-stores", JSON.stringify(stores));
            return;
          case "plugin:websocket|connect":
            return new Promise((resolve, reject) => {
              const id = nextId++;
              const socket = new WebSocket(args.url);
              socket.onopen = () => {
                sockets.set(id, socket);
                resolve(id);
              };
              socket.onerror = () => reject(new Error("Cannot connect."));
              socket.onmessage = ({ data }) =>
                args.onMessage.onmessage({ type: "Text", data });
              socket.onclose = () => {
                sockets.delete(id);
                args.onMessage.onmessage({ type: "Close", data: null });
              };
            });
          case "plugin:websocket|send": {
            const socket = sockets.get(args.id);
            if (args.message.type === "Close") socket?.close();
            else socket?.send(args.message.data);
            return;
          }
        }
        throw new Error(`Unexpected native command: ${command}`);
      },
    };
  });
  return { exchanges };
}
