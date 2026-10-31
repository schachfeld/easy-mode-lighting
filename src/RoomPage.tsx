import type { ReactNode } from "react";
import { ArrowLeft, Plus, Settings2 } from "lucide-react";
import {
  averageBrightness,
  lightTargets,
  roomLightLayout,
} from "../packages/core/groups.mjs";
import { Brightness, Toggle } from "./components";
import { plural } from "./format";
import { LightCard } from "./LightCard";
import type { Home, LightsAction, Room, Scene } from "./types";

export function RoomPage({
  home,
  room,
  disabled,
  onBack,
  onLightsChange,
  onAdjustLight,
  onCustomize,
  onCreateScene,
  renderScene,
}: {
  home: Home;
  room: Room;
  disabled: boolean;
  onBack: () => void;
  onLightsChange: LightsAction;
  onAdjustLight: (id: string) => void;
  onCustomize: () => void;
  onCreateScene: () => void;
  renderScene: (scene: Scene) => ReactNode;
}) {
  const lights = home.lights.filter((l) => l.roomId === room.id);
  const onCount = lights.filter((l) => l.on && l.available).length;
  const anyAvailable = lights.some((l) => l.available);
  const hasGroups = home.groups?.some((group) => group.roomId === room.id);
  const layout = roomLightLayout(home, room.id);
  const scenes = home.scenes.filter((s) => s.roomId === room.id);
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        All rooms
      </button>
      <div className={`room-detail-hero room-${room.style}`}>
        <div className="room-detail-title">
          <h1>{room.name}</h1>
          <p>
            {onCount} of {plural(lights.length, "light")} on
          </p>
        </div>
        <div className="room-detail-power">
          <span>{onCount ? "Lights on" : "Lights off"}</span>
          <Toggle
            label={`${room.name} all lights`}
            on={onCount > 0}
            disabled={disabled || !anyAvailable}
            onChange={() => onLightsChange(lights, { on: !onCount })}
          />
        </div>
      </div>
      {lights.some((l) => l.dimmable) && (
        <div className="room-master-brightness">
          <span>Room brightness</span>
          <Brightness
            value={averageBrightness(lights)}
            label="Room brightness"
            disabled={disabled || !anyAvailable}
            onChange={(brightness) =>
              onLightsChange(lights, { on: true, brightness })
            }
          />
        </div>
      )}
      <section className="section">
        <div className="section-heading">
          <div>
            <h2>
              Scenes <span className="count-label">{scenes.length}</span>
            </h2>
          </div>
          <button className="button primary" onClick={onCreateScene}>
            <Plus size={17} />
            Create scene
          </button>
        </div>
        <div className="scenes-grid">{scenes.map((s) => renderScene(s))}</div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <h2>
              Lights <span className="count-label">{lights.length}</span>
            </h2>
          </div>
          {hasGroups && (
            <button
              className="text-button customize-lights"
              onClick={onCustomize}
            >
              <Settings2 size={16} /> Customize lights
            </button>
          )}
        </div>
        {layout.overlapping.length > 0 && (
          <p className="group-settings-note">
            Some groups share lights. Their lamps are shown individually so each
            appears once.
          </p>
        )}
        <div className="lights-grid">
          {layout.items.map((light) => (
            <LightCard
              key={light.id}
              light={light}
              members={
                "memberIds" in light
                  ? lightTargets(home, light.memberIds)
                  : undefined
              }
              disabled={disabled}
              onChange={onLightsChange}
              onAdjust={onAdjustLight}
            />
          ))}
        </div>
      </section>
    </>
  );
}
