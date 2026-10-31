import type { CSSProperties } from "react";
import { ChevronRight, Layers, Lightbulb, LightbulbOff } from "lucide-react";
import { colorName, displayColor, whiteName } from "../packages/core/color.mjs";
import { Brightness, Toggle } from "./components";
import { plural } from "./format";
import { fillPaint, glowStyle, litColors } from "./glow";
import type { Light, LightGroup, LightSettings } from "./types";

export function lightDescription(light: Light) {
  if (!light.available) return "Unavailable";
  if (!light.on) return "Off";
  if (light.colorMode === "color_temp" && light.temperatureSupported)
    return `${whiteName(light.kelvin)} · ${light.kelvin} K`;
  if (light.colorSupported) return colorName(light.color);
  return "On";
}

export function LightCard({
  light,
  members,
  disabled,
  onChange,
  onAdjust,
}: {
  light: Light | LightGroup;
  members?: Light[];
  disabled: boolean;
  onChange: (lights: Light[], settings: Partial<LightSettings>) => void;
  onAdjust: (id: string) => void;
}) {
  const onCount =
    members?.filter((member) => member.available && member.on).length ?? 0;
  const lit = light.on && light.available;
  const colors = litColors(members ?? [light]);
  return (
    <article
      className={`light-card glow-card ${lit ? "is-on" : "is-off"} ${members ? "light-group-card" : ""} ${light.available ? "" : "unavailable"}`}
      style={glowStyle(members ?? [light])}
    >
      <div className="light-card-heading">
        <button
          className="light-name-button"
          onClick={() => onAdjust(light.id)}
        >
          <span
            className="bulb-icon"
            style={
              lit
                ? ({
                    "--bulb": colors[0] ?? displayColor(light),
                  } as CSSProperties)
                : undefined
            }
          >
            {members ? (
              <Layers size={22} strokeWidth={1.7} />
            ) : light.available ? (
              <Lightbulb size={22} strokeWidth={1.7} />
            ) : (
              <LightbulbOff size={22} strokeWidth={1.7} />
            )}
          </span>
          <span className="light-text">
            <h3>{light.name}</h3>
            <small>
              {members
                ? `${plural(members.length, "light")} · ${onCount} on${members.some((member) => !member.available) ? " · Some unavailable" : ""}`
                : lightDescription(light)}
            </small>
          </span>
        </button>
        <Toggle
          label={`${light.name} power`}
          on={light.on}
          disabled={disabled || !light.available}
          onChange={() => onChange(members ?? [light], { on: !light.on })}
        />
      </div>
      <div className="light-card-controls">
        {light.dimmable && (
          <Brightness
            value={light.on ? light.brightness : 0}
            disabled={disabled || !light.available}
            label={`${light.name} brightness`}
            compact
            paint={fillPaint(colors)}
            onChange={(brightness) =>
              onChange(members ?? [light], { brightness, on: true })
            }
          />
        )}
        <button
          className="light-adjust-link"
          onClick={() => onAdjust(light.id)}
        >
          {members ? "Adjust group" : "Adjust light"}
          <ChevronRight size={15} />
        </button>
      </div>
      {members && (
        <details className="light-group-details">
          <summary>
            Individual lights{" "}
            <span className="count-label">{members.length}</span>
          </summary>
          <div className="light-group-members">
            {members.map((member) => (
              <LightCard
                key={member.id}
                light={member}
                disabled={disabled}
                onChange={onChange}
                onAdjust={onAdjust}
              />
            ))}
          </div>
        </details>
      )}
    </article>
  );
}
