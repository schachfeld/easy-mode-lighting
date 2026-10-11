import WebSocket from "ws";
import { HomeAssistant as SharedHomeAssistant } from "../packages/core/home-assistant.mjs";

export class HomeAssistant extends SharedHomeAssistant {
  constructor(options) {
    super({
      ...options,
      sceneRequest: async ({ url, method, token, body, timeoutMs }) => {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          redirect: "error",
          signal: AbortSignal.timeout(timeoutMs),
        });
        return {
          status: response.status,
          body: await response.json().catch(() => null),
        };
      },
      createSocket: (url) =>
        new WebSocket(url, { handshakeTimeout: options.timeoutMs ?? 12000 }),
    });
  }
}
