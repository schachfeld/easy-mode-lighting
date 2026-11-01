// Color helpers for matching and describing lights. Colors are "#rrggbb"
// strings; hue is in degrees and saturation and value are 0–1.

export function hexToHsv(hex) {
  const value = /^#?([a-f\d]{6})$/i.exec(hex ?? "")?.[1] ?? "ffffff";
  const [r, g, b] = [0, 2, 4].map(
    (i) => parseInt(value.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hex = (rgb) =>
  "#" +
  rgb
    .map((c) =>
      Math.round(clamp(c, 0, 255))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

export function hsvToHex(h, s, v = 1) {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  return hex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

// The on-screen color of white light, after Tanner Helland's black-body fit,
// softened toward white the way eyes adapt to warm light in a room.
export function whiteToHex(kelvin) {
  const t = clamp(kelvin, 1000, 40000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b =
    t >= 66
      ? 255
      : t <= 19
        ? 0
        : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return hex([r, g, b].map((c) => clamp(c, 0, 255) * 0.7 + 255 * 0.3));
}

// Home Assistant converts colors to the bulb's native color space and back,
// and reports them at full value, so a bulb rarely returns the exact color it
// was sent. Compare hue and saturation with tolerance instead.
export function colorsClose(a, b) {
  if (!a || !b) return false;
  const [x, y] = [hexToHsv(a), hexToHsv(b)];
  if (x.s < 0.12 && y.s < 0.12) return true;
  const hue = Math.abs(x.h - y.h);
  return Math.min(hue, 360 - hue) <= 12 && Math.abs(x.s - y.s) <= 0.15;
}

// Bulbs and Home Assistant round color temperatures through mireds.
export const kelvinClose = (a, b) => Math.abs(a - b) < 80;

// Upper hue bounds for friendly color names.
const hueNames = [
  [8, "Red"],
  [22, "Coral"],
  [34, "Orange"],
  [50, "Amber"],
  [68, "Yellow"],
  [95, "Lime"],
  [155, "Green"],
  [185, "Teal"],
  [205, "Cyan"],
  [245, "Blue"],
  [270, "Indigo"],
  [300, "Purple"],
  [335, "Pink"],
  [350, "Rose"],
  [360, "Red"],
];

export function colorName(hex) {
  const { h, s } = hexToHsv(hex);
  if (s < 0.12) return "White";
  const name = hueNames.find(([max]) => h < max)?.[1] ?? "Red";
  return s < 0.4 ? `Soft ${name.toLowerCase()}` : name;
}

export function whiteName(kelvin) {
  if (kelvin < 2450) return "Candlelight";
  if (kelvin < 3100) return "Warm white";
  if (kelvin < 4300) return "Neutral white";
  if (kelvin < 5600) return "Cool white";
  return "Daylight";
}
