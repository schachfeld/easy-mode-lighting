import type { CSSProperties } from "react";
import { displayColor } from "../packages/core/color.mjs";
import { averageBrightness } from "../packages/core/groups.mjs";
import type { Light } from "./types";

// The colors lit lights give off, most common first.
export function litColors(lights: Light[]) {
  const counts = new Map<string, number>();
  for (const light of lights)
    if (light.on && light.available) {
      const color = displayColor(light);
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([color]) => color);
}

// A gradient for a brightness fill. A single color still needs a gradient:
// CSS only allows plain colors in the last background layer.
export function fillPaint(colors: string[]) {
  if (!colors.length) return "none";
  const stops = colors.slice(0, 3);
  return `linear-gradient(to right, ${stops.length === 1 ? `${stops[0]}, ${stops[0]}` : stops.join(", ")})`;
}

// Card backgrounds take on the colors of their lights, stronger when brighter.
export function glowStyle(lights: Light[]): CSSProperties {
  const colors = litColors(lights);
  if (!colors.length) return {};
  const [c1, c2 = c1, c3 = c2] = colors;
  const lit = lights.filter((light) => light.on && light.available);
  const brightness = lit.some((light) => light.dimmable)
    ? averageBrightness(lit)
    : 100;
  return {
    "--glow-1": c1,
    "--glow-2": c2,
    "--glow-3": c3,
    "--glow-strength": (0.45 + (0.55 * brightness) / 100).toFixed(2),
  } as CSSProperties;
}
