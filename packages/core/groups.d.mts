import type { Home, Light, LightGroup, LightSettings } from "./types";
export function lightTargets(home: Home, ids: string[]): Light[];
export function expandSceneLights(
  home: Pick<Home, "groups">,
  settings: Record<string, LightSettings>,
): Record<string, LightSettings>;
export function roomLightLayout(
  home: Home,
  roomId: string,
): { items: (Light | LightGroup)[]; overlapping: LightGroup[] };
