import { Check, ChevronRight } from "lucide-react";
import { averageBrightness } from "../packages/core/groups.mjs";
import { Brightness, RoomIcon, SceneOrb, Toggle } from "./components";
import { plural } from "./format";
import { fillPaint, glowStyle, litColors } from "./glow";
import { sceneColors, sceneMatches } from "./scenes";
import type { Light, LightsAction, Palette, Room, Scene } from "./types";

export function RoomCard({
  room,
  lights,
  scenes,
  palettes,
  disabled,
  onOpen,
  onLightsChange,
  onActivateScene,
}: {
  room: Room;
  // The lights in this room.
  lights: Light[];
  scenes: Scene[];
  palettes: Palette[];
  disabled: boolean;
  onOpen: (roomId: string) => void;
  onLightsChange: LightsAction;
  onActivateScene: (scene: Scene) => void;
}) {
  const count = lights.filter((l) => l.on && l.available).length;
  const on = count > 0;
  const anyAvailable = lights.some((l) => l.available);
  const roomScenes = scenes.filter((s) => s.roomId === room.id);
  const active = roomScenes.find((s) => sceneMatches(s, lights));
  // Favorites sit on the card for one-tap moods, with the active scene first.
  const quick = [
    ...(on && active ? [active] : []),
    ...roomScenes.filter((s) => s.favorite && s !== active),
  ].slice(0, 3);
  return (
    <article
      className={`room-card glow-card room-${room.style} ${on ? "is-on" : "is-off"}`}
      style={glowStyle(lights)}
    >
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
          <ChevronRight size={18} className="room-chevron" />
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
          paint={fillPaint(litColors(lights))}
          onChange={(brightness) =>
            onLightsChange(lights, { on: true, brightness })
          }
        />
      )}
      {quick.length > 0 && (
        <div
          className="scene-chips"
          role="group"
          aria-label={`${room.name} favorite scenes`}
        >
          {quick.map((scene) => {
            const current = on && scene === active;
            return (
              <button
                key={scene.id}
                className={`scene-chip ${current ? "active" : ""}`}
                disabled={disabled}
                aria-label={`Set ${room.name} to ${scene.name}`}
                aria-pressed={current}
                onClick={() => onActivateScene(scene)}
              >
                <SceneOrb colors={sceneColors(scene, palettes)} size="small" />
                <span>{scene.name}</span>
                {current && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
