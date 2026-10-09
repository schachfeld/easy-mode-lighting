import WebSocket from "ws";
import { HomeAssistant as SharedHomeAssistant } from "../packages/core/home-assistant.mjs";

export class HomeAssistant extends SharedHomeAssistant {
  constructor(options) {
    super({
      ...options,
      createSocket: (url) =>
        new WebSocket(url, { handshakeTimeout: options.timeoutMs ?? 12000 }),
    });
  }
}
