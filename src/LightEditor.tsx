import { useState, type CSSProperties } from "react";
import {
  Check,
  Lightbulb,
  LightbulbOff,
  Palette,
  SunMedium,
} from "lucide-react";
import {
  colorsClose,
  displayColor,
  whiteName,
  whiteToHex,
} from "../packages/core/color.mjs";
import { ColorWheel } from "./ColorWheel";
import {
  Brightness,
  kelvinGradient,
  LiveSlider,
  Modal,
  Toggle,
} from "./components";
import { plural } from "./format";
import { fillPaint } from "./glow";
import { lightDescription } from "./LightCard";
import type { Light, LightGroup, LightsAction } from "./types";

// Full-value colors survive Home Assistant's color space conversions intact.
const swatches = [
  { name: "Amber", color: "#ffb347" },
  { name: "Coral", color: "#ff8466" },
  { name: "Rose", color: "#ff6f9c" },
  { name: "Orchid", color: "#c77dff" },
  { name: "Periwinkle", color: "#7b83ff" },
  { name: "Sky", color: "#5bb8ff" },
  { name: "Lagoon", color: "#4fd6c4" },
  { name: "Lime", color: "#a8e063" },
];
const whites = [
  { name: "Cozy", kelvin: 2200 },
  { name: "Warm", kelvin: 2700 },
  { name: "Fresh", kelvin: 4000 },
  { name: "Cool", kelvin: 6000 },
];

// The adjust dialog for a single light or a light group.
export function LightEditor({
  light,
  roomName,
  disabled,
  error,
  onChange,
  onClose,
}: {
  light: Light | LightGroup;
  roomName?: string;
  disabled: boolean;
  error?: string;
  onChange: LightsAction;
  onClose: () => void;
}) {
  const locked = disabled || !light.available;
  const both = light.colorSupported && light.temperatureSupported;
  const [tab, setTab] = useState<"color" | "white">(
    !light.colorSupported ||
      (light.temperatureSupported && light.colorMode === "color_temp")
      ? "white"
      : "color",
  );
  const supportedKelvin = (kelvin: number) =>
    Math.max(light.minKelvin, Math.min(light.maxKelvin, kelvin));
  const white = light.colorMode === "color_temp";
  const kelvin = supportedKelvin(white ? light.kelvin : 2700);
  const selectedWhite = white
    ? whites.find(
        (w) => Math.abs(supportedKelvin(w.kelvin) - light.kelvin) < 80,
      )
    : undefined;
  const glow = displayColor(light);
  const lit = light.on && light.available;
  const showColor = light.colorSupported && (!both || tab === "color");
  const showWhite = light.temperatureSupported && (!both || tab === "white");
  return (
    <Modal
      title={light.name}
      subtitle={[
        roomName,
        "memberIds" in light ? plural(light.memberIds.length, "light") : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      onClose={onClose}
      className="light-modal"
    >
      <div
        className={`light-modal-power ${lit ? "is-on" : ""}`}
        style={{ "--bulb": glow } as CSSProperties}
      >
        <span className="bulb-preview" aria-hidden="true">
          {light.available ? (
            <Lightbulb size={30} strokeWidth={1.6} />
          ) : (
            <LightbulbOff size={30} strokeWidth={1.6} />
          )}
        </span>
        <span className="light-modal-status">
          <strong>
            {light.available
              ? light.on
                ? "Looking bright"
                : "Taking a little rest"
              : "Light unavailable"}
          </strong>
          <small>
            {lit && light.dimmable
              ? `${lightDescription(light)} · ${light.brightness}%`
              : lightDescription(light)}
          </small>
        </span>
        <Toggle
          label="Light power"
          on={light.on}
          disabled={locked}
          onChange={() => onChange([light], { on: !light.on })}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {light.dimmable && (
        <div className="field">
          <span className="field-label">Brightness</span>
          <Brightness
            value={light.on ? light.brightness : 0}
            onChange={(brightness) =>
              onChange([light], { brightness, on: true })
            }
            paint={fillPaint([glow])}
            disabled={locked}
          />
        </div>
      )}
      {both && (
        <div
          className="segmented light-tabs"
          role="tablist"
          aria-label="Light color"
        >
          <button
            role="tab"
            aria-selected={tab === "color"}
            className={tab === "color" ? "selected" : ""}
            onClick={() => setTab("color")}
          >
            <Palette size={16} /> Color
          </button>
          <button
            role="tab"
            aria-selected={tab === "white"}
            className={tab === "white" ? "selected" : ""}
            onClick={() => setTab("white")}
          >
            <SunMedium size={16} /> White
          </button>
        </div>
      )}
      {showColor && (
        <div className="field color-field" role={both ? "tabpanel" : undefined}>
          {!both && <span className="field-label">Color</span>}
          <div className="color-layout">
            <ColorWheel
              color={light.colorMode === "rgb" ? light.color : "#ffffff"}
              label={`${light.name} color`}
              disabled={locked}
              onChange={(color) =>
                onChange([light], { color, colorMode: "rgb", on: true })
              }
            />
            <div className="color-swatches">
              {swatches.map((swatch) => {
                const selected =
                  light.colorMode === "rgb" &&
                  colorsClose(light.color, swatch.color);
                return (
                  <button
                    key={swatch.color}
                    style={{ "--swatch": swatch.color } as CSSProperties}
                    className={selected ? "selected" : ""}
                    aria-label={`Set color ${swatch.name}`}
                    aria-pressed={selected}
                    title={swatch.name}
                    disabled={locked}
                    onClick={() =>
                      onChange([light], {
                        color: swatch.color,
                        colorMode: "rgb",
                        on: true,
                      })
                    }
                  >
                    {selected && <Check size={16} strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showWhite && (
        <div className="field white-field" role={both ? "tabpanel" : undefined}>
          {!both && <span className="field-label">White</span>}
          {light.maxKelvin > light.minKelvin && (
            <LiveSlider
              value={kelvin}
              min={light.minKelvin}
              max={light.maxKelvin}
              step={50}
              spectrum
              paint={kelvinGradient(light.minKelvin, light.maxKelvin)}
              label="White temperature"
              disabled={locked}
              format={(value) => `${value} K`}
              valueText={(value) => `${value} K, ${whiteName(value)}`}
              onChange={(value) =>
                onChange([light], {
                  kelvin: value,
                  colorMode: "color_temp",
                  on: true,
                })
              }
            />
          )}
          <div className="white-presets">
            {whites.map((preset) => {
              const value = supportedKelvin(preset.kelvin);
              return (
                <button
                  key={preset.name}
                  disabled={locked}
                  className={selectedWhite === preset ? "selected" : ""}
                  aria-pressed={selectedWhite === preset}
                  style={{ "--swatch": whiteToHex(value) } as CSSProperties}
                  onClick={() =>
                    onChange([light], {
                      kelvin: value,
                      colorMode: "color_temp",
                      on: true,
                    })
                  }
                >
                  <span className="white-dot" aria-hidden="true" />
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="modal-footer">
        <button className="button primary" onClick={onClose}>
          Done
          <Check size={16} />
        </button>
      </div>
    </Modal>
  );
}
