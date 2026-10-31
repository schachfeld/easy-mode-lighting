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
