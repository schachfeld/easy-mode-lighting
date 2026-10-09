import { Channel, invoke } from "@tauri-apps/api/core";
import WebSocket, { type Message } from "@tauri-apps/plugin-websocket";
import { NativeSocket } from "../../packages/core/native-socket.mjs";

export function createSocket(url: string) {
  return new NativeSocket(
    url,
    async (address: string, receive: (message: Message) => void) => {
      // Register before connect resolves: HA may send auth_required immediately.
      const onMessage = new Channel<Message>();
      onMessage.onmessage = receive;
      const id = await invoke<number>("plugin:websocket|connect", {
        url: address,
        onMessage,
        config: { maxMessageSize: 16 * 1024 * 1024 },
      });
      return new WebSocket(id, new Set());
    },
  );
}
