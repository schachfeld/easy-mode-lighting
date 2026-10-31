import type { Light, Scene } from "./types";
export function sceneMatches(
  scene: Pick<Scene, "lights">,
  lights: Light[],
): boolean;
