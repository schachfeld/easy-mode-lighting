import { Events } from "../../../packages/core/events.mjs";

// Adapts React Native's WebSocket to the small Node-style socket the shared
// Home Assistant client expects. Closing reports "close" at once: after a
// phone wakes up, a dead connection can take minutes to finish closing.
export class AppSocket extends Events {
  readyState = 0;
  private socket: WebSocket;

  constructor(url: string) {
    super();
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      if (this.readyState === 0) this.readyState = 1;
    };
    socket.onmessage = (event) => {
      if (this.readyState === 1 && typeof event.data === "string")
        this.emit("message", event.data);
    };
    socket.onerror = () => {
      if (this.readyState !== 3) this.emit("error");
    };
    socket.onclose = () => this.close();
  }

  send(data: string) {
    if (this.readyState !== 1)
      throw new Error("Home Assistant is disconnected.");
    this.socket.send(data);
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.socket.onopen = null;
    this.socket.onmessage = null;
    this.socket.onerror = null;
    this.socket.onclose = null;
    try {
      this.socket.close();
    } catch {
      // Already closed.
    }
    this.emit("close");
  }

  terminate() {
    this.close();
  }
}

export const createSocket = (url: string) => new AppSocket(url);
