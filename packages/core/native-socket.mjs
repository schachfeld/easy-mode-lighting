import { Events } from "./events.mjs";

// The native plugin opens asynchronously. Buffer early frames (especially HA's
// auth_required) until the transport can send a reply.
export class NativeSocket extends Events {
  readyState = 0;
  constructor(url, connect) {
    super();
    const buffered = [];
    const receive = (message) => {
      if (this.readyState === 3) return;
      if (this.readyState === 0) buffered.push(message);
      else this.receive(message);
    };
    Promise.resolve()
      .then(() => connect(url, receive))
      .then(async (socket) => {
        this.native = socket;
        if (this.readyState === 3) {
          await socket.disconnect().catch(() => {});
          return;
        }
        this.readyState = 1;
        for (const message of buffered) this.receive(message);
      })
      .catch(() => {
        if (this.readyState === 3) return;
        this.emit("error");
        this.close();
      });
  }
  receive(message) {
    if (this.readyState !== 1) return;
    if (message.type === "Text") this.emit("message", message.data);
    if (message.type === "Close") this.close();
  }
  async send(data) {
    if (this.readyState !== 1)
      throw new Error("Home Assistant is disconnected.");
    try {
      await this.native.send(data);
    } catch (error) {
      this.emit("error");
      this.close();
      throw error;
    }
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.native?.disconnect().catch(() => {});
    this.emit("close");
  }
  terminate() {
    this.close();
  }
}
