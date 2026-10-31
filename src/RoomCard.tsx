import { ChevronRight } from "lucide-react";
import { averageBrightness } from "../packages/core/groups.mjs";
import { Brightness, RoomIcon, Toggle } from "./components";
import { plural } from "./format";
import { sceneMatches } from "./scenes";
import type { Light, LightsAction, Room, Scene } from "./types";

export function RoomCard({
  room,
  lights,
  scenes,
  disabled,
  onOpen,
  onLightsChange,
}: {
  room: Room;
  // The lights in this room.
  lights: Light[];
  scenes: Scene[];
  disabled: boolean;
  onOpen: (roomId: string) => void;
  onLightsChange: LightsAction;
}) {
  const count = lights.filter((l) => l.on && l.available).length;
  const on = count > 0;
  const anyAvailable = lights.some((l) => l.available);
  const active = scenes.find(
    (s) => s.roomId === room.id && sceneMatches(s, lights),
  );
  return (
    <article
      className={`room-card room-${room.style} ${on ? "room-on" : "room-off"}`}
    >
      <div className="room-info">
        <div className="room-card-heading">
          <button
            className="room-name"
            aria-label={`Open ${room.name}`}
            onClick={() => onOpen(room.id)}
          >
            <span className="room-icon">
              <RoomIcon style={room.style} />
            </span>
            <span className="room-name-text">
              <h3>{room.name}</h3>
              <p>
                {!anyAvailable
                  ? "Lights unavailable"
                  : count
                    ? `${count} of ${plural(lights.length, "light")} on`
                    : `${plural(lights.length, "light")} · All off`}
              </p>
            </span>
            <ChevronRight size={16} />
          </button>
          <Toggle
            label={`${room.name} lights`}
            on={on}
            disabled={disabled || !anyAvailable}
            onChange={() => onLightsChange(lights, { on: !on })}
          />
        </div>
        {lights.some((l) => l.dimmable) && (
          <Brightness
            value={on ? averageBrightness(lights) : 0}
            label={`${room.name} brightness`}
            disabled={disabled || !anyAvailable}
            compact
            onChange={(brightness) =>
              onLightsChange(lights, { on: true, brightness })
            }
          />
        )}
        {on && active && <p className="room-active-scene">{active.name}</p>}
      </div>
    </article>
  );
}
