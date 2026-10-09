import { Events } from "./events.mjs";

export class HomeAssistant extends Events {
  constructor({ url, token, retryMs = 3000, timeoutMs = 12000, createSocket }) {
    super();
    this.createSocket = createSocket;
    this.url = url;
    this.token = token;
    this.retryMs = retryMs;
    this.timeoutMs = timeoutMs;
    this.pending = new Map();
    this.nextId = 1;
    this.states = {};
    this.areas = [];
    this.devices = [];
    this.entities = [];
    this.connected = false;
    this.stopped = false;
    this.error = null;
  }

  start() {
    if (this.stopped || this.socket) return;
    clearTimeout(this.retryTimer);
    const socket = this.createSocket(this.url);
    this.socket = socket;
    const authTimer = setTimeout(() => socket.terminate(), this.timeoutMs);
    socket.on("message", async (raw) => {
      if (this.socket !== socket || this.stopped) return;
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "auth_required")
          await socket.send(
            JSON.stringify({ type: "auth", access_token: this.token }),
          );
        if (message.type === "auth_invalid") {
          this.error =
            "Home Assistant rejected the connection. Check the app permissions or access token.";
          this.stopped = true;
          socket.close();
        }
        if (message.type === "auth_ok") {
          clearTimeout(authTimer);
          // Subscribe first so changes during initial discovery are not lost.
          this.initialEvents = [];
          await this.request("subscribe_events", {
            event_type: "state_changed",
          });
          const [states] = await Promise.all([
            this.request("get_states"),
            this.loadRegistries(),
          ]);
          this.states = Object.fromEntries(states.map((s) => [s.entity_id, s]));
          for (const data of this.initialEvents ?? []) this.updateState(data);
          this.initialEvents = null;
          for (const event_type of [
            "area_registry_updated",
            "device_registry_updated",
            "entity_registry_updated",
          ])
            await this.request("subscribe_events", { event_type });
          if (this.socket !== socket || this.stopped) return;
          this.connected = true;
          this.error = null;
          this.heartbeat = setInterval(() => {
            this.request("ping").catch(() => socket.terminate());
          }, 30000);
          this.emit("change");
        }
        if (message.type === "result" || message.type === "pong") {
          const pending = this.pending.get(message.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(message.id);
            if (message.success === false)
              pending.reject(
                new Error(
                  message.error?.message ??
                    "Home Assistant could not complete that action.",
                ),
              );
            else pending.resolve(message.result);
          }
        }
        if (message.type === "event") {
          if (message.event.event_type === "state_changed") {
            const data = message.event.data;
            if (this.initialEvents) this.initialEvents.push(data);
            else this.updateState(data);
          } else {
            await this.loadRegistries();
          }
          if (this.connected) this.emit("change");
        }
      } catch (error) {
        if (this.socket !== socket || this.stopped) return;
        this.error = error.message;
        if (!this.connected) socket.close();
        this.emit("change");
      }
    });
    socket.on("error", () => {
      if (this.socket !== socket) return;
      this.error =
        "Cannot reach Home Assistant. Glow will reconnect automatically.";
    });
    socket.on("close", () => {
      clearTimeout(authTimer);
      if (this.socket !== socket) return;
      clearInterval(this.heartbeat);
      this.socket = null;
      this.connected = false;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(
          new Error(
            "Home Assistant disconnected. Please try again after it reconnects.",
          ),
        );
      }
      this.pending.clear();
      this.emit("change");
      if (!this.stopped)
        this.retryTimer = setTimeout(() => this.start(), this.retryMs);
    });
  }

  updateState({ entity_id, new_state }) {
    if (new_state) this.states[entity_id] = new_state;
    else delete this.states[entity_id];
  }

  async loadRegistries() {
    const [areas, devices, entities] = await Promise.all([
      this.request("config/area_registry/list"),
      this.request("config/device_registry/list"),
      this.request("config/entity_registry/list"),
    ]);
    this.areas = areas;
    this.devices = devices;
    this.entities = entities;
  }

  request(type, data = {}) {
    if (this.socket?.readyState !== 1)
      return Promise.reject(new Error("Home Assistant is not connected yet."));
    const socket = this.socket;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            "Home Assistant took too long to respond. Please try again.",
          ),
        );
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      Promise.resolve()
        .then(() => socket.send(JSON.stringify({ id, type, ...data })))
        .catch((error) => {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        });
    });
  }

  call(domain, service, service_data = {}, target) {
    if (!this.connected)
      throw new Error(
        "Home Assistant is disconnected. Your lights have not been changed.",
      );
    return this.request("call_service", {
      domain,
      service,
      service_data,
      ...(target ? { target } : {}),
    });
  }

  reconnect() {
    if (this.stopped) return;
    if (this.socket) this.socket.terminate();
    else this.start();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeat);
    this.socket?.close();
  }
}
