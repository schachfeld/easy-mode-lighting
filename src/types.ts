import type { Light, LightSettings } from "../packages/core/types";

export * from "../packages/core/types";

// Sends settings to lights, groups or a whole room. Resolves false on failure,
// after the error has already been shown.
export type LightsAction = (
  lights: Light[],
  settings: Partial<LightSettings>,
) => Promise<boolean>;
