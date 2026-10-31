import test from "node:test";
import assert from "node:assert/strict";
import {
  colorName,
  colorsClose,
  displayColor,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  kelvinToHex,
  mixColors,
  whiteName,
  whiteToHex,
} from "../packages/core/color.mjs";

test("colors match after Home Assistant's color space round trip", () => {
  // Home Assistant converts RGB to hue and saturation, then reports the
  // color back at full value, so exact comparisons never match real bulbs.
  assert.equal(colorsClose("#f5bf76", "#ffc77b"), true);
  assert.equal(colorsClose("#ee947e", "#ff9f87"), true);
  assert.equal(colorsClose("#da77a2", "#DA77A2"), true);
  assert.equal(colorsClose("#f5bf76", "#83b5d5"), false);
  assert.equal(colorsClose("#ff8466", "#ff6f9c"), false);
  // Hue wraps around red.
  assert.equal(colorsClose("#ff0a00", "#ff000a"), true);
  // Whites match each other regardless of their faint tint.
  assert.equal(colorsClose("#fffefa", "#f8f8ff"), true);
  assert.equal(colorsClose("#fffefa", "#ff0000"), false);
  assert.equal(colorsClose("", "#ff0000"), false);
});

test("hue, saturation and value conversions round trip", () => {
  for (const color of ["#ff0000", "#ffb347", "#7b83ff", "#4fd6c4", "#ffffff"])
    assert.equal(hsvToHex(...Object.values(hexToHsv(color))), color);
  assert.deepEqual(hexToHsv("#00ff00"), { h: 120, s: 1, v: 1 });
  assert.equal(hsvToHex(240, 1), "#0000ff");
  assert.equal(hsvToHex(-120, 1), "#0000ff");
  assert.equal(mixColors("#000000", "#ffffff", 0.5), "#808080");
  assert.deepEqual(hexToRgb("not a color"), [255, 255, 255]);
});

test("white light is warm at low temperatures and neutral at daylight", () => {
  const [r, g, b] = hexToRgb(kelvinToHex(2200));
  assert.equal(r, 255);
  assert.ok(b < 60 && g < 160, "2200 K is deep amber");
  assert.ok(
    hexToRgb(kelvinToHex(6500)).every((c) => c > 240),
    "6500 K is close to white",
  );
  // On screen, whites are softened the way eyes adapt to them in a room.
  const raw = hexToRgb(kelvinToHex(2700));
  const shown = hexToRgb(whiteToHex(2700));
  assert.ok(shown[2] > raw[2]);
});

test("a light's on-screen color follows its mode and capabilities", () => {
  assert.equal(
    displayColor({ colorMode: "rgb", color: "#FF8466", kelvin: 2700 }),
    "#ff8466",
  );
  assert.equal(
    displayColor({
      colorMode: "color_temp",
      color: "#ff0000",
      kelvin: 2700,
      temperatureSupported: true,
    }),
    whiteToHex(2700),
  );
  // Brightness-only bulbs glow warm white, whatever color they report.
  assert.equal(
    displayColor({
      colorMode: "rgb",
      color: "#ff0000",
      kelvin: 2700,
      colorSupported: false,
      temperatureSupported: false,
    }),
    whiteToHex(2700),
  );
});

test("colors and whites have friendly names", () => {
  assert.equal(colorName("#ff0000"), "Red");
  assert.equal(colorName("#00ff00"), "Green");
  assert.equal(colorName("#0000ff"), "Blue");
  assert.equal(colorName("#ffffff"), "White");
  assert.equal(colorName("#ffb3b3"), "Soft red");
  // The sunset palette's salmon is coral, not red.
  assert.equal(colorName("#ee947e"), "Coral");
  // Light editor swatches read back under their own names.
  for (const [hex, name] of [
    ["#ffb347", "Amber"],
    ["#ff8466", "Coral"],
    ["#ff6f9c", "Rose"],
    ["#c77dff", "Purple"],
    ["#4fd6c4", "Teal"],
    ["#a8e063", "Lime"],
  ])
    assert.equal(colorName(hex), name);
  assert.equal(whiteName(2200), "Candlelight");
  assert.equal(whiteName(2700), "Warm white");
  assert.equal(whiteName(4000), "Neutral white");
  assert.equal(whiteName(5000), "Cool white");
  assert.equal(whiteName(6500), "Daylight");
});
