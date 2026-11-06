// Starts the Home Assistant used by the end-to-end tests (tests/ha/), for
// trying the app on an emulator or device. It adds a light group, so group
// cards can be tried too, and stays up until you press Ctrl+C.
//
//   node --experimental-transform-types native/e2e/home-assistant.ts
//
// Run it from the repository root. Docker is required.
import {
  arrangeHome,
  owner,
  resetLights,
  startHomeAssistant,
  stopHomeAssistant,
  type HomeAssistantClient,
} from "../../tests/ha/home-assistant.ts";

async function addLightGroup(ha: HomeAssistantClient) {
  const step = async (path: string, body: object) => {
    const response = await fetch(
      new URL(`api/config/config_entries/flow${path}`, ha.url),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ha.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) throw new Error(`Light group: ${await response.text()}`);
    return response.json();
  };
  const { flow_id } = await step("", { handler: "group" });
  await step(`/${flow_id}`, { next_step_id: "light" });
  await step(`/${flow_id}`, {
    name: "Living lamps",
    entities: ["light.sofa_lamp", "light.ceiling_light"],
    hide_members: false,
    all: false,
  });
}

const { id, ha } = await startHomeAssistant();
const stop = () => {
  stopHomeAssistant(id);
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await arrangeHome(ha);
await addLightGroup(ha);
await resetLights(ha);
const port = new URL(ha.url).port;
console.log(`
Home Assistant is running.

  On this computer:     ${ha.url}
  In Android emulators: http://10.0.2.2:${port}/
  Account:              ${owner.username} / ${owner.password}
  Access token:         ${ha.token}

Press Ctrl+C to stop it.`);
// Keep running until Ctrl+C; a bare pending promise would let Node exit.
setInterval(() => {}, 60_000);
