import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Pinned so a Home Assistant release cannot break CI unannounced. Override
// with HA_IMAGE to try another version.
export const image =
  process.env.HA_IMAGE ?? "ghcr.io/home-assistant/home-assistant:2026.10.4";
const configDir = fileURLToPath(new URL("./config", import.meta.url));

export type State = {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
};

const docker = (...args: string[]) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 600000 }).trim();

async function until<T>(
  description: string,
  check: () => Promise<T | undefined>,
  timeoutMs = 120000,
) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value !== undefined) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${description}`, {
    cause: lastError,
  });
}

// A client for the Home Assistant instance inside the container, used to
// arrange state and to check what Glow did to the lights.
export class HomeAssistantClient {
  constructor(
    readonly url: string,
    readonly token: string,
  ) {}

  async rest(path: string, method = "GET", body?: unknown) {
    const response = await fetch(new URL(`api/${path}`, this.url), {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
    return response.json();
  }

  state(entityId: string): Promise<State> {
    return this.rest(`states/${entityId}`);
  }

  async states(): Promise<State[]> {
    return this.rest("states");
  }

  call(domain: string, service: string, data: Record<string, unknown>) {
    return this.rest(`services/${domain}/${service}`, "POST", data);
  }

  // One WebSocket command, for the registry APIs that REST does not offer.
  ws(type: string, data: Record<string, unknown> = {}): Promise<any> {
    const socket = new WebSocket(
      new URL("api/websocket", this.url).href.replace(/^http/, "ws"),
    );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error(`${type} timed out`));
      }, 10000);
      socket.onerror = () => reject(new Error(`${type} could not connect`));
      socket.onmessage = ({ data: raw }) => {
        const message = JSON.parse(String(raw));
        if (message.type === "auth_required")
          socket.send(
            JSON.stringify({ type: "auth", access_token: this.token }),
          );
        else if (message.type === "auth_ok")
          socket.send(JSON.stringify({ id: 1, type, ...data }));
        else if (message.type === "auth_invalid" || message.type === "result") {
          clearTimeout(timer);
          socket.close();
          if (message.success) resolve(message.result);
          else
            reject(
              new Error(
                `${type}: ${message.error?.message ?? message.message}`,
              ),
            );
        }
      };
    });
  }
}

export type Container = { id: string; ha: HomeAssistantClient };

// Starts a fresh Home Assistant with the mock lights, creates the owner
// account through onboarding, and returns a long-lived token for it.
export async function startHomeAssistant(): Promise<Container> {
  try {
    docker("image", "inspect", image);
  } catch {
    docker("pull", image);
  }
  // Copy the configuration in rather than bind-mounting it, so files Home
  // Assistant writes as root never end up in the working tree.
  const id = docker(
    "create",
    "--rm",
    "-p",
    "127.0.0.1::8123",
    "-e",
    "TZ=UTC",
    image,
  );
  try {
    docker("cp", `${configDir}/.`, `${id}:/config`);
    docker("start", id);
    const address = docker("port", id, "8123/tcp").split("\n")[0];
    const url = `http://${address}/`;
    await until("Home Assistant to accept onboarding", async () => {
      const response = await fetch(new URL("api/onboarding", url), {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok ? true : undefined;
    });
    const clientId = url;
    const onboarding = await fetch(new URL("api/onboarding/users", url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        name: "Glow Tester",
        username: "glow",
        password: "glow-e2e-password",
        language: "en",
      }),
    });
    if (!onboarding.ok)
      throw new Error(`Onboarding failed: ${await onboarding.text()}`);
    const { auth_code } = await onboarding.json();
    const tokens = await fetch(new URL("auth/token", url), {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: auth_code,
        client_id: clientId,
      }),
    });
    if (!tokens.ok) throw new Error(`Login failed: ${await tokens.text()}`);
    const { access_token } = await tokens.json();
    const token: string = await new HomeAssistantClient(url, access_token).ws(
      "auth/long_lived_access_token",
      { client_name: "Glow e2e", lifespan: 1 },
    );
    return { id, ha: new HomeAssistantClient(url, token) };
  } catch (error) {
    stopHomeAssistant(id, true);
    throw error;
  }
}

export function stopHomeAssistant(id: string, printLogs = false) {
  try {
    if (printLogs) console.error(docker("logs", id));
  } finally {
    docker("rm", "--force", id);
  }
}

export const areas = {
  "Living room": ["light.sofa_lamp", "light.ceiling_light"],
  Bedroom: ["light.bedside_lamp", "light.wardrobe_light"],
};
export const lights = [...Object.values(areas).flat(), "light.porch_light"];

// Put the lights into Home Assistant areas, as a user would in Settings.
export async function arrangeHome(ha: HomeAssistantClient) {
  await until("the mock lights to load", async () => {
    const ids = new Set((await ha.states()).map((s) => s.entity_id));
    return lights.every((id) => ids.has(id)) ? true : undefined;
  });
  // Onboarding already creates a few common areas, such as Living room.
  const existing: { area_id: string; name: string }[] = await ha.ws(
    "config/area_registry/list",
  );
  for (const [name, entities] of Object.entries(areas)) {
    const match = existing.find(
      (area) => area.name.toLowerCase() === name.toLowerCase(),
    );
    const { area_id } = match
      ? await ha.ws("config/area_registry/update", {
          area_id: match.area_id,
          name,
        })
      : await ha.ws("config/area_registry/create", { name });
    for (const entity_id of entities)
      await ha.ws("config/entity_registry/update", { entity_id, area_id });
  }
}

// Every test starts from the same lights, whatever the previous one changed.
export async function resetLights(ha: HomeAssistantClient) {
  await ha.call("light", "turn_off", {
    entity_id: lights.filter((id) => id !== "light.sofa_lamp"),
  });
  await ha.call("light", "turn_on", {
    entity_id: "light.sofa_lamp",
    brightness: 128,
    color_temp_kelvin: 2700,
  });
}

export { until };
