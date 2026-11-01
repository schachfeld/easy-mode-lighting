import test from "node:test";
import assert from "node:assert/strict";
import {
  colorName,
  colorsClose,
  hexToHsv,
  hsvToHex,
  kelvinClose,
  whiteToHex,
  whiteName,
} from "../packages/core/color.mjs";
import { sceneMatches } from "../packages/core/scenes.mjs";

const light = (overrides = {}) => ({
  id: "light.lamp",
  name: "Lamp",
  roomId: "room",
  available: true,
  on: true,
  brightness: 60,
  color: "#ffffff",
  kelvin: 2700,
  colorMode: "rgb",
  dimmable: true,
  colorSupported: true,
  temperatureSupported: true,
  minKelvin: 2000,
  maxKelvin: 6500,
  ...overrides,
});

test("colors match after Home Assistant's color space round trip", () => {
  // Home Assistant converts RGB to the bulb's color space, then reports the
  // color back at full value, so exact comparisons never match real bulbs.
  assert.equal(colorsClose("#f5bf76", "#ffc77b"), true);
  assert.equal(colorsClose("#ee947e", "#ff9f87"), true);
  assert.equal(colorsClose("#da77a2", "#DA77A2"), true);
  assert.equal(colorsClose("#f5bf76", "#83b5d5"), false);
  assert.equal(colorsClose("#f28e82", "#d888b7"), false);
  // Hue wraps around red.
  assert.equal(colorsClose("#ff0a00", "#ff000a"), true);
  // Whites match each other regardless of their faint tint.
  assert.equal(colorsClose("#fffefa", "#f8f8ff"), true);
  assert.equal(colorsClose("#fffefa", "#ff0000"), false);
  assert.equal(colorsClose("", "#ff0000"), false);
  assert.equal(kelvinClose(2700, 2703), true);
  assert.equal(kelvinClose(2700, 4000), false);
  assert.deepEqual(hexToHsv("#00ff00"), { h: 120, s: 1, v: 1 });
  assert.deepEqual(hexToHsv("not a color"), { h: 0, s: 0, v: 1 });
});

test("scenes stay active after Home Assistant rounds a bulb's color and temperature", () => {
  const scene = {
    lights: {
      "light.lamp": {
        on: true,
        brightness: 60,
        color: "#ee947e",
        kelvin: 2700,
        colorMode: "rgb",
      },
      "light.ceiling": {
        on: true,
        brightness: 40,
        color: "#f5bf76",
        kelvin: 2700,
        colorMode: "color_temp",
      },
      "light.shelf": {
        on: false,
        brightness: 1,
        color: "#ffffff",
        kelvin: 2700,
        colorMode: "rgb",
      },
    },
  };
  // What Home Assistant reports back: full-value RGB, rounded temperatures.
  const reported = [
    light({ color: "#ff9f87", brightness: 61 }),
    light({
      id: "light.ceiling",
      colorMode: "color_temp",
      kelvin: 2703,
      brightness: 40,
      color: "#ffa757",
    }),
    light({ id: "light.shelf", on: false }),
  ];
  const [, ceiling, shelf] = reported;
  assert.equal(sceneMatches(scene, reported), true);
  // A different color, brightness or power state is a different look.
  assert.equal(
    sceneMatches(scene, [light({ color: "#83b5d5" }), ceiling, shelf]),
    false,
  );
  assert.equal(
    sceneMatches(scene, [
      light({ color: "#ff9f87", brightness: 75 }),
      ceiling,
      shelf,
    ]),
    false,
  );
  assert.equal(
    sceneMatches(scene, [
      reported[0],
      ceiling,
      light({ id: "light.shelf", on: true }),
    ]),
    false,
  );
  // Unavailable or missing lights never match, and neither do empty scenes.
  assert.equal(
    sceneMatches(scene, [
      light({ color: "#ff9f87", available: false }),
      ceiling,
      shelf,
    ]),
    false,
  );
  assert.equal(sceneMatches(scene, [reported[0], ceiling]), false);
  assert.equal(sceneMatches({ lights: {} }, reported), false);
});

test("scenes match within what each bulb supports", () => {
  const scene = {
    lights: {
      "light.lamp": {
        on: true,
        brightness: 60,
        color: "#ffffff",
        kelvin: 6500,
        colorMode: "color_temp",
      },
    },
  };
  // A bulb that tops out at 4000 K is as cool as it can be.
  assert.equal(
    sceneMatches(scene, [
      light({ colorMode: "color_temp", kelvin: 4000, maxKelvin: 4000 }),
    ]),
    true,
  );
  // Brightness-only bulbs match on power and brightness alone.
  assert.equal(
    sceneMatches(scene, [
      light({ temperatureSupported: false, colorSupported: false }),
    ]),
    true,
  );
});

test("color wheel positions and white temperatures convert to colors", () => {
  for (const color of ["#ff0000", "#ffb347", "#7b83ff", "#4fd6c4", "#ffffff"]) {
    const { h, s, v } = hexToHsv(color);
    assert.equal(hsvToHex(h, s, v), color);
  }
  assert.equal(hsvToHex(240, 1), "#0000ff");
  assert.equal(hsvToHex(-120, 1), "#0000ff");
  assert.equal(hsvToHex(0, 0), "#ffffff");
  // Warm white is amber; daylight is close to white.
  const warm = hexToHsv(whiteToHex(2200));
  assert.ok(warm.h > 20 && warm.h < 40 && warm.s > 0.4);
  assert.ok(hexToHsv(whiteToHex(6500)).s < 0.05);
  assert.ok(hexToHsv(whiteToHex(2700)).s > hexToHsv(whiteToHex(4000)).s);
});

test("colors and whites have friendly names", () => {
  assert.equal(colorName("#ff0000"), "Red");
  assert.equal(colorName("#00ff00"), "Green");
  assert.equal(colorName("#0000ff"), "Blue");
  assert.equal(colorName("#ffffff"), "White");
  assert.equal(colorName("#ffb3b3"), "Soft red");
  assert.equal(colorName("#ee947e"), "Coral");
  assert.equal(colorName("#83b5d5"), "Soft cyan");
  assert.equal(whiteName(2200), "Candlelight");
  assert.equal(whiteName(2700), "Warm white");
  assert.equal(whiteName(4000), "Neutral white");
  assert.equal(whiteName(5000), "Cool white");
  assert.equal(whiteName(6500), "Daylight");
});
