import type { Page } from "@playwright/test";

export async function nativeHost(page: Page) {
  await page.addInitScript(() => {
    const host = window as any;
    host.isTauri = true;
    let nextId = 1;
    const sockets = new Map<number, any>();
    const sceneDisk = JSON.parse(
      localStorage.getItem("test-native-scenes") ?? "{}",
    );
    const pendingDisk = JSON.parse(
      localStorage.getItem("test-native-pending") ?? "{}",
    );
    const callbacks = new Map<number, Function>();
    const eventListeners = new Map<number, number>();
    host.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: (_: string, id: number) => eventListeners.delete(id),
    };
    host.__deepLink = (url: string) => {
      for (const [id, handler] of eventListeners)
        callbacks.get(handler)?.({
          id,
          event: "deep-link://new-url",
          payload: [url],
        });
    };
    host.__tokenRequests = [];
    host.__reauthenticate = false;
    let tokenSequence = 0;
    let failSave = false;
    let savedVault = false;
    let vaultPassword = "";
    let vaultRecord: number[] | null = null;
    let unloads = 0;
    host.__vaultUnloads = () => unloads;
    const states = [
      {
        entity_id: "light.floor",
        state: "on",
        attributes: {
          friendly_name: "Floor lamp",
          supported_color_modes: ["rgb"],
          brightness: 150,
          rgb_color: [250, 180, 90],
        },
      },
    ];
    host.__nativeCalls = [];
    host.__failSave = () => {
      failSave = true;
    };
    host.__TAURI_INTERNALS__ = {
      transformCallback: (callback: Function) => {
        const id = nextId++;
        callbacks.set(id, callback);
        return id;
      },
      unregisterCallback: (id: number) => callbacks.delete(id),
      invoke: async (command: string, args: any = {}) => {
        if (command === "plugin:event|listen") {
          const id = nextId++;
          eventListeners.set(id, args.handler);
          return id;
        }
        if (command === "plugin:event|unlisten") {
          eventListeners.delete(args.eventId);
          return;
        }
        if (command === "plugin:deep-link|get_current") {
          const url = sessionStorage.getItem("test-startup-link");
          return url ? [url] : null;
        }
        if (command === "plugin:opener|open_url") {
          host.__browserUrl = args.url;
          return;
        }
        if (command === "ha_token_request") {
          host.__tokenRequests.push(args.request);
          if (host.__reauthenticate)
            throw {
              message:
                "Your Home Assistant sign-in is no longer valid. Please sign in again.",
              reauthenticate: true,
            };
          return {
            access_token: `account-access-${++tokenSequence}`,
            expires_in: 1800,
            ...(args.request.grantType === "authorization_code"
              ? { refresh_token: "account-refresh-secret" }
              : {}),
          };
        }
        if (command === "has_saved_connection") return savedVault;
        if (command === "forget_connection") {
          savedVault = false;
          vaultRecord = null;
          vaultPassword = "";
          return;
        }
        if (command === "plugin:path|resolve_directory") return "/test/appdata";
        if (command === "plugin:path|join") return args.paths.join("/");
        if (command === "plugin:stronghold|initialize") {
          if (savedVault && args.password !== vaultPassword)
            throw new Error("Invalid password");
          vaultPassword = args.password;
          return;
        }
        if (
          [
            "plugin:stronghold|create_client",
            "plugin:stronghold|load_client",
          ].includes(command)
        )
          return;
        if (command === "plugin:stronghold|save_store_record") {
          vaultRecord = args.value;
          return;
        }
        if (command === "plugin:stronghold|get_store_record")
          return vaultRecord;
        if (command === "plugin:stronghold|save") {
          savedVault = true;
          return;
        }
        if (command === "plugin:stronghold|destroy") {
          unloads++;
          return;
        }
        if (command === "plugin:store|load")
          return args.path === "pending-login.json" ? 2 : 1;
        const disk = args.rid === 2 ? pendingDisk : sceneDisk;
        if (command === "plugin:store|delete") {
          delete disk[args.key];
          return true;
        }
        if (command === "plugin:store|get")
          return [disk[args.key], args.key in disk];
        if (command === "plugin:store|set") {
          disk[args.key] = args.value;
          return;
        }
        if (command === "plugin:store|save") {
          if (failSave) {
            failSave = false;
            throw new Error("Disk full");
          }
          localStorage.setItem(
            args.rid === 2 ? "test-native-pending" : "test-native-scenes",
            JSON.stringify(disk),
          );
          return;
        }
        if (command === "plugin:websocket|connect") {
          const id = nextId++;
          sockets.set(id, args.onMessage);
          // Deliver before connect resolves, as native IPC is allowed to do.
          args.onMessage.onmessage({
            type: "Text",
            data: JSON.stringify({ type: "auth_required" }),
          });
          return id;
        }
        if (command === "plugin:websocket|send") {
          const channel = sockets.get(args.id);
          if (args.message.type === "Close") {
            sockets.delete(args.id);
            return;
          }
          const message = JSON.parse(args.message.data);
          host.__nativeCalls.push(message);
          const send = (data: any) =>
            channel.onmessage({ type: "Text", data: JSON.stringify(data) });
          if (message.type === "auth") {
            send({
              type:
                message.access_token === "test-token" ||
                message.access_token.startsWith("account-access-")
                  ? "auth_ok"
                  : "auth_invalid",
            });
            return;
          }
          const responses: Record<string, unknown> = {
            get_states: states,
            "config/area_registry/list": [
              { area_id: "living", name: "Living room" },
            ],
            "config/device_registry/list": [],
            "config/entity_registry/list": [
              { entity_id: "light.floor", area_id: "living" },
            ],
          };
          if (message.type === "call_service" && message.domain === "light") {
            states[0].state = message.service === "turn_off" ? "off" : "on";
            if (message.service_data.brightness !== undefined)
              states[0].attributes.brightness = message.service_data.brightness;
            send({
              type: "event",
              event: {
                event_type: "state_changed",
                data: { entity_id: "light.floor", new_state: states[0] },
              },
            });
          }
          send({
            type: message.type === "ping" ? "pong" : "result",
            id: message.id,
            success: true,
            result: responses[message.type] ?? null,
          });
          return;
        }
        throw new Error(`Unexpected native command: ${command}`);
      },
    };
  });
}
