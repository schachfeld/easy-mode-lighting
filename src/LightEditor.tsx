import { Check, Lightbulb, Sun } from "lucide-react";
import { Brightness, Modal, Toggle } from "./components";
import { plural } from "./format";
import type { Light, LightGroup, LightsAction } from "./types";

const swatches = [
  "#f5bf76",
  "#f28e82",
  "#d888b7",
  "#afa0d6",
  "#83b5d5",
  "#9fc39a",
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
  const supportedKelvin = (kelvin: number) =>
    Math.max(light.minKelvin, Math.min(light.maxKelvin, kelvin));
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
    >
      <div className="light-modal-power">
        <span
          className="bulb-icon"
          style={{ color: light.on ? light.color : undefined }}
        >
          <Lightbulb size={32} />
        </span>
        <span>
          {light.available
            ? light.on
              ? "Looking bright"
              : "Taking a little rest"
            : "Light unavailable"}
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
        <>
          <span className="field-label">Brightness</span>
          <Brightness
            value={light.on ? light.brightness : 0}
            onChange={(brightness) =>
              onChange([light], { brightness, on: true })
            }
            disabled={locked}
          />
        </>
      )}
      {light.colorSupported && (
        <>
          <div className="field-heading">
            <span className="field-label">A splash of color</span>
            <label className="color-picker">
              <input
                type="color"
                value={light.color}
                aria-label="Custom light color"
                disabled={locked}
                onChange={(e) =>
                  onChange([light], {
                    color: e.target.value,
                    colorMode: "rgb",
                    on: true,
                  })
                }
              />
              <span>Custom</span>
            </label>
          </div>
          <div className="color-swatches">
            {swatches.map((color) => (
              <button
                key={color}
                style={{ background: color }}
                className={light.color === color ? "selected" : ""}
                aria-label={`Set color ${color}`}
                disabled={locked}
                onClick={() =>
                  onChange([light], { color, colorMode: "rgb", on: true })
                }
              >
                {light.color === color && <Check size={17} />}
              </button>
            ))}
          </div>
        </>
      )}
      {light.temperatureSupported && (
        <>
          <div className="field-heading">
            <span className="field-label">Or a softer shade of white</span>
          </div>
          <div className="white-presets">
            {whites.map((white) => {
              const kelvin = supportedKelvin(white.kelvin);
              return (
                <button
                  key={white.name}
                  disabled={locked}
                  className={
                    light.colorMode === "color_temp" && light.kelvin === kelvin
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    onChange([light], {
                      kelvin,
                      colorMode: "color_temp",
                      on: true,
                    })
                  }
                >
                  <Sun size={19} />
                  <span>{white.name}</span>
                </button>
              );
            })}
          </div>
        </>
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
