import type { Light, Scene } from "./types";

// A scene is active when every light it sets currently looks the way the scene
// would leave it, within the tolerance of bulbs that round their values.
export function sceneMatches(scene: Scene, lights: Light[]) {
  const entries = Object.entries(scene.lights);
  return (
    entries.length > 0 &&
    entries.every(([id, settings]) => {
      const l = lights.find((l) => l.id === id);
      if (!l?.available || l.on !== settings.on) return false;
      if (!l.on) return true;
      return (
        (!l.dimmable || Math.abs(l.brightness - settings.brightness) <= 2) &&
        (settings.colorMode === "color_temp"
          ? !l.temperatureSupported ||
            Math.abs(
              l.kelvin -
                Math.max(l.minKelvin, Math.min(l.maxKelvin, settings.kelvin)),
            ) < 80
          : !l.colorSupported ||
            l.color.toLowerCase() === settings.color.toLowerCase())
      );
    })
  );
}
