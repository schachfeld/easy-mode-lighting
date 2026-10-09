import { test, expect, type Page } from "@playwright/test";

// Exercise the real mobile UI, native adapter and shared HA protocol. Only the
// Tauri IPC boundary is mocked; native Rust compilation is a separate CI check.
async function nativeHost(page: Page) {
  await page.addInitScript(() => {
    const host = window as any;
    host.isTauri = true;
    let nextId = 1;
    const sockets = new Map<number, any>();
    const sceneDisk = JSON.parse(
      localStorage.getItem("test-native-scenes") ?? "{}",
    );
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
      transformCallback: () => nextId++,
      unregisterCallback: () => {},
      invoke: async (command: string, args: any = {}) => {
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
        if (command === "plugin:store|load") return 1;
        if (command === "plugin:store|get")
          return [sceneDisk[args.key], args.key in sceneDisk];
        if (command === "plugin:store|set") {
          sceneDisk[args.key] = args.value;
          return;
        }
        if (command === "plugin:store|save") {
          if (failSave) {
            failSave = false;
            throw new Error("Disk full");
          }
          localStorage.setItem("test-native-scenes", JSON.stringify(sceneDisk));
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
                message.access_token === "test-token"
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

async function connect(
  page: Page,
  token = "test-token",
  address = "http://homeassistant.local:8123",
) {
  await page.getByLabel("Home Assistant address").fill(address);
  await page.getByLabel("Long-lived access token").fill(token);
  await page.getByRole("button", { name: "Connect to my home" }).click();
}

test("mobile connects directly, controls lights, persists scenes per home and disconnects", async ({
  page,
}) => {
  await nativeHost(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mobile/");
  await expect(
    page.getByRole("heading", { name: "A little closer to home." }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/glow-mobile-connect.png",
    fullPage: true,
  });
  await connect(page);
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("switch", { name: "Living room lights", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Living room lights", exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Open Living room", exact: true })
    .click();
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await page.getByLabel("Scene name", { exact: true }).fill("Mobile evening");
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.screenshot({
    path: "artifacts/glow-mobile-room.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => Object.values(localStorage).join(" ")),
  ).not.toContain("test-token");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little closer to home." }),
  ).toBeVisible();
  await connect(page);
  await expect(
    page.getByRole("button", {
      name: "Activate Mobile evening in Living room",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /connected/ }).click();
  await expect(
    page.getByText("Glow scenes stay on this device.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.getByLabel("Long-lived access token")).toHaveValue("");
  await connect(page, "test-token", "http://second-home.local:8123");
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Activate Mobile evening in Living room",
      exact: true,
    }),
  ).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile reports invalid tokens and failed saves without losing the editor", async ({
  page,
}) => {
  await nativeHost(page);
  await page.goto("/mobile/");
  await connect(page, "bad-token");
  await expect(page.getByRole("alert")).toContainText("rejected");
  await connect(page);
  await page
    .getByRole("button", { name: "Open Living room", exact: true })
    .click();
  await page.getByRole("button", { name: "Create scene", exact: true }).click();
  await page.getByLabel("Scene name", { exact: true }).fill("Keep my work");
  await page.evaluate(() => (window as any).__failSave());
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText(
      "Could not save your scenes. Check the device’s available storage.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save scene", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("mobile preview explains native-only connection and offers encrypted remembering", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mobile/");
  await page.getByLabel("Remember this connection").check();
  await expect(page.getByLabel("Create a vault passphrase")).toBeVisible();
  await expect(page.getByLabel("Confirm passphrase")).toBeVisible();
  await page.getByLabel("Remember this connection").uncheck();
  await connect(page);
  await expect(page.getByRole("alert")).toContainText(
    "mobile interface preview",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("remembered credentials use the native vault, unlock errors are recoverable, and forgetting returns to setup", async ({
  page,
}) => {
  await nativeHost(page);
  await page.goto("/mobile/");
  await page.getByLabel("Remember this connection").check();
  await page
    .getByLabel("Create a vault passphrase")
    .fill("correct horse battery staple");
  await page
    .getByLabel("Confirm passphrase")
    .fill("correct horse battery staple");
  await connect(page);
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__vaultUnloads())).toBe(1);
  await page.getByRole("button", { name: /connected/ }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome home." }),
  ).toBeVisible();
  await page.getByLabel("Vault passphrase").fill("wrong passphrase");
  await page.getByRole("button", { name: "Unlock & connect" }).click();
  await expect(page.getByRole("alert")).toContainText("Could not unlock");
  await page
    .getByLabel("Vault passphrase")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Unlock & connect" }).click();
  await expect(
    page.getByRole("button", { name: "Open Living room", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__vaultUnloads())).toBe(2);
  expect(
    await page.evaluate(() => Object.values(localStorage).join(" ")),
  ).not.toContain("test-token");
  await page.getByRole("button", { name: /connected/ }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page.getByRole("button", { name: "Forget saved connection" }).click();
  await expect(
    page.getByRole("heading", { name: "A little closer to home." }),
  ).toBeVisible();
  await expect(page.getByLabel("Long-lived access token")).toHaveValue("");
});
