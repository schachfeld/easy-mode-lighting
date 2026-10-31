// Color helpers shared by the interface and scene matching. Colors are
// "#rrggbb" strings; hue is in degrees and saturation/value are 0–1.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function hexToRgb(hex) {
  const value = /^#?([a-f\d]{6})$/i.exec(hex ?? "")?.[1];
  if (!value) return [255, 255, 255];
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}

export function rgbToHex(rgb) {
  return (
    "#" +
    rgb
      .map((c) =>
        Math.round(clamp(c, 0, 255))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function rgbToHsv([r, g, b]) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const delta = max - Math.min(rr, gg, bb);
  let h = 0;
  if (delta) {
    if (max === rr) h = ((gg - bb) / delta) % 6;
    else if (max === gg) h = (bb - rr) / delta + 2;
    else h = (rr - gg) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}

export function hexToHsv(hex) {
  return rgbToHsv(hexToRgb(hex));
}

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
  return rgbToHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

export function mixColors(a, b, amount) {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return rgbToHex(x.map((c, i) => c + (y[i] - c) * amount));
}

// Approximates a black body's color, after Tanner Helland's fit.
export function kelvinToHex(kelvin) {
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
  return rgbToHex([r, g, b]);
}

// Eyes adapt to warm light, so a raw black-body color looks far more orange
// on screen than the lamp does in the room. Soften it toward white.
export function whiteToHex(kelvin) {
  return mixColors(kelvinToHex(kelvin), "#ffffff", 0.3);
}

const warmWhite = whiteToHex(2700);

// The color a light gives off, for drawing it on screen.
export function displayColor(light) {
  if (light.colorMode === "color_temp" && light.temperatureSupported !== false)
    return whiteToHex(light.kelvin);
  if (
    light.colorSupported !== false &&
    /^#[a-f\d]{6}$/i.test(light.color ?? "")
  )
    return light.color.toLowerCase();
  return warmWhite;
}

// Home Assistant converts colors to the bulb's native color space and back,
// and reports them at full value. Compare hue and saturation with tolerance.
export function colorsClose(a, b) {
  if (!a || !b) return false;
  const [x, y] = [hexToHsv(a), hexToHsv(b)];
  if (x.s < 0.12 && y.s < 0.12) return true;
  const hue = Math.abs(x.h - y.h);
  return Math.min(hue, 360 - hue) <= 12 && Math.abs(x.s - y.s) <= 0.15;
}

const hueNames = [
  [12, "Red"],
  [35, "Orange"],
  [50, "Amber"],
  [68, "Yellow"],
  [95, "Lime"],
  [155, "Green"],
  [185, "Teal"],
  [205, "Cyan"],
  [250, "Blue"],
  [275, "Indigo"],
  [300, "Purple"],
  [335, "Pink"],
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
