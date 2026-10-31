import { Check, Heart, Pencil } from "lucide-react";
import { SceneOrb } from "./components";
import { plural } from "./format";
import { sceneMatches } from "./scenes";
import type { Home, Scene } from "./types";

export function SceneCard({
  scene,
  home,
  inRoom,
  disabled,
  onActivate,
  onFavorite,
  onEdit,
}: {
  scene: Scene;
  home: Home;
  // Inside a room the room name is redundant, so show what the scene covers.
  inRoom: boolean;
  disabled: boolean;
  onActivate: (scene: Scene) => void;
  onFavorite: (scene: Scene) => void;
  onEdit: (scene: Scene) => void;
}) {
  const sceneRoom = home.rooms.find((r) => r.id === scene.roomId);
  const active = sceneMatches(scene, home.lights);
  const lightCount = Object.keys(scene.lights).length;
  return (
    <article className={`scene-card ${active ? "active" : ""}`}>
      <button
        className="scene-activate"
        disabled={disabled}
        aria-label={`Activate ${scene.name} in ${sceneRoom?.name ?? "your home"}`}
        onClick={() => onActivate(scene)}
      >
        <SceneOrb palette={scene.palette} />
        <div className="scene-text">
          <h3>{scene.name}</h3>
          <p>
            {inRoom
              ? // Home Assistant scenes without Glow settings list no lights.
                lightCount
                ? plural(lightCount, "light")
                : "Room lights"
              : (sceneRoom?.name ?? "Whole home")}
          </p>
        </div>
        {active && (
          <span className="scene-active-mark">
            <Check size={13} />
          </span>
        )}
      </button>
      <button
        className={`scene-favorite icon-button ${scene.favorite ? "favorited" : ""}`}
        aria-label={`${scene.favorite ? "Unfavorite" : "Favorite"} ${scene.name}`}
        aria-pressed={scene.favorite}
        onClick={() => onFavorite(scene)}
      >
        <Heart size={15} fill={scene.favorite ? "currentColor" : "none"} />
      </button>
      {scene.source === "glow" && (
        <button
          className="scene-edit icon-button"
          aria-label={`Edit ${scene.name}`}
          onClick={() => onEdit(scene)}
        >
          <Pencil size={15} />
        </button>
      )}
      {(scene.source === "home-assistant" || scene.haSceneId) && (
        <span className="native-badge">Home Assistant</span>
      )}
    </article>
  );
}
