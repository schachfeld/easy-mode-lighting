import { Check, Lightbulb, Sun } from "lucide-react";
import {
  colorName,
  colorsClose,
  kelvinClose,
} from "../packages/core/color.mjs";
import { ColorWheel } from "./ColorWheel";
import { Brightness, Modal, Toggle, WhiteSlider } from "./components";
import { plural } from "./format";
import type { Light, LightGroup, LightsAction, Room } from "./types";

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

const newRoom = "glow:new-room";

// The adjust dialog for a single light or a light group.
export function LightEditor({
  light,
  roomName,
  disabled,
  error,
  onChange,
  onClose,
  rooms,
  onMove,
  onNewRoom,
}: {
  light: Light | LightGroup;
  roomName?: string;
  disabled: boolean;
  error?: string;
  onChange: LightsAction;
  onClose: () => void;
  // Every room the light can join, including rooms without lights yet.
  rooms: Room[];
  onMove: (roomId: string) => void;
  onNewRoom: () => void;
}) {
  const locked = disabled || !light.available;
  const supportedKelvin = (kelvin: number) =>
    Math.max(light.minKelvin, Math.min(light.maxKelvin, kelvin));
  // Bulbs report colors and temperatures slightly differently from what they
  // were sent, so match within tolerance. A white light's reported color is
  // only an approximation and never selects a swatch.
  const selectedColor =
    light.colorMode === "rgb"
      ? swatches.find((color) => colorsClose(light.color, color))
      : undefined;
  const selectedWhite =
    light.colorMode === "color_temp"
      ? whites.find((white) =>
          kelvinClose(light.kelvin, supportedKelvin(white.kelvin)),
        )
      : undefined;
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
          </div>
          <div className="color-picker-area">
            <ColorWheel
              color={light.color}
              white={light.colorMode === "color_temp"}
              label={`${light.name} color`}
              disabled={locked}
              onChange={(color) =>
                onChange([light], { color, colorMode: "rgb", on: true })
              }
            />
            <div className="color-swatches">
              {swatches.map((color) => (
                <button
                  key={color}
                  style={{ background: color }}
                  className={selectedColor === color ? "selected" : ""}
                  aria-label={`Set color ${colorName(color)}`}
                  aria-pressed={selectedColor === color}
                  disabled={locked}
                  onClick={() =>
                    onChange([light], { color, colorMode: "rgb", on: true })
                  }
                >
                  {selectedColor === color && <Check size={17} />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {light.temperatureSupported && (
        <>
          <div className="field-heading">
            <span className="field-label">Or a softer shade of white</span>
          </div>
          <WhiteSlider
            value={supportedKelvin(light.kelvin)}
            min={light.minKelvin}
            max={light.maxKelvin}
            inactive={light.colorMode !== "color_temp"}
            disabled={locked}
            onChange={(kelvin) =>
              onChange([light], { kelvin, colorMode: "color_temp", on: true })
            }
          />
          <div className="white-presets">
            {whites.map((white) => {
              const kelvin = supportedKelvin(white.kelvin);
              return (
                <button
                  key={white.name}
                  disabled={locked}
                  className={selectedWhite === white ? "selected" : ""}
                  aria-pressed={selectedWhite === white}
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
      <div className="field-heading">
        <label className="field-label" htmlFor="light-room">
          Room
        </label>
      </div>
      <select
        id="light-room"
        className="text-input room-select"
        value={light.roomId}
        disabled={disabled || light.movable === false}
        onChange={(event) =>
          event.target.value === newRoom
            ? onNewRoom()
            : onMove(event.target.value)
        }
      >
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}
          </option>
        ))}
        <option value="unassigned" disabled={light.roomFromDevice}>
          No room
        </option>
        <option value={newRoom}>New room…</option>
      </select>
      {(light.movable === false || light.roomFromDevice) && (
        <p className="room-select-note">
          {light.movable === false
            ? "This light has no unique ID in Home Assistant, so its room can only be set in its integration."
            : "Its device sets this room in Home Assistant. Choosing another room moves only this light."}
        </p>
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
