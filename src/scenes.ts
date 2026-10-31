import { colorsClose, displayColor } from "../packages/core/color.mjs";
import type { Light, Palette, Scene } from "./types";

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
          : !l.colorSupported || colorsClose(l.color, settings.color))
      );
    })
  );
}

// The colors a scene paints with, for its orb. Home Assistant scenes do not
// expose their settings, so they fall back to their palette.
export function sceneColors(scene: Scene, palettes: Palette[]) {
  const colors = [
    ...new Set(
      Object.values(scene.lights)
        .filter((settings) => settings.on)
        .map((settings) => displayColor(settings)),
    ),
  ];
  if (colors.length) return colors.slice(0, 3);
  if (Object.keys(scene.lights).length) return ["#3a3b36"];
  const palette = palettes.find((p) => p.id === scene.palette);
  return palette?.colors ?? ["#f5bf76", "#e59461", "#f5dfa9"];
}

// What a palette will actually look like once applied: white palettes set
// color temperatures on lights that support them.
export function paletteColors(palette: Palette) {
  return palette.kelvin
    ? [
        displayColor({
          colorMode: "color_temp",
          kelvin: palette.kelvin,
          color: "",
        }),
      ]
    : palette.colors;
}
