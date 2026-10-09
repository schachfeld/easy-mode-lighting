import { ChevronRight, Layers, Lightbulb } from "lucide-react";
import { Brightness, Toggle } from "./components";
import type { Light, LightGroup, LightSettings } from "./types";

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
  return (
    <article
      className={`light-card ${light.on ? "light-on" : ""} ${members ? "light-group-card" : ""}`}
    >
      <div className="light-card-heading">
        <button
          className="light-name-button"
          onClick={() => onAdjust(light.id)}
        >
          <span
            className="bulb-icon"
            style={{ color: light.on ? light.color : undefined }}
          >
            {members ? (
              <Layers size={23} strokeWidth={1.5} />
            ) : (
              <Lightbulb size={23} strokeWidth={1.5} />
            )}
          </span>
          <span>
            <h3>{light.name}</h3>
            <small>
              {members
                ? `${members.length} lights · ${onCount} on${members.some((member) => !member.available) ? " · Some unavailable" : ""}`
                : !light.available
                  ? "Unavailable"
                  : light.on
                    ? light.colorMode === "color_temp"
                      ? `${light.kelvin} K · White light`
                      : "Color light"
                    : "Off"}
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
      {light.dimmable && (
        <Brightness
          value={light.brightness}
          disabled={disabled || !light.available}
          label={`${light.name} brightness`}
          compact
          onChange={(brightness) =>
            onChange(members ?? [light], { brightness, on: true })
          }
        />
      )}
      <button className="light-adjust-link" onClick={() => onAdjust(light.id)}>
        {members ? "Adjust group" : "Adjust light"}
        <ChevronRight size={13} />
      </button>
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
