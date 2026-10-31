import type { CSSProperties } from "react";
import { Check, Heart, Pencil } from "lucide-react";
import { SceneOrb } from "./components";
import { plural } from "./format";
import { sceneColors, sceneMatches } from "./scenes";
import type { Home, Scene } from "./types";

export function SceneCard({
  scene,
  home,
  disabled,
  onActivate,
  onFavorite,
  onEdit,
}: {
  scene: Scene;
  home: Home;
  disabled: boolean;
  onActivate: (scene: Scene) => void;
  onFavorite: (scene: Scene) => void;
  onEdit: (scene: Scene) => void;
}) {
  const sceneRoom = home.rooms.find((r) => r.id === scene.roomId);
  const active = sceneMatches(scene, home.lights);
  const lightCount = Object.keys(scene.lights).length;
  const colors = sceneColors(scene, home.palettes);
  const [c1, c2 = c1] = colors;
  return (
    <article
      className={`scene-card ${active ? "active" : ""}`}
      style={{ "--c1": c1, "--c2": c2 } as CSSProperties}
    >
      <button
        className="scene-activate"
        disabled={disabled}
        aria-label={`Activate ${scene.name} in ${sceneRoom?.name ?? "your home"}`}
        onClick={() => onActivate(scene)}
      >
        <SceneOrb colors={colors} size="medium" />
        <div className="scene-text">
          <h3>{scene.name}</h3>
          <p>
            {active ? (
              <span className="scene-active-label">
                <Check size={13} strokeWidth={2.5} /> Active
              </span>
            ) : lightCount ? (
              plural(lightCount, "light")
            ) : // Home Assistant scenes do not expose their settings.
            sceneRoom ? (
              "Room lights"
            ) : (
              "Several rooms"
            )}
          </p>
          {(scene.source === "home-assistant" || scene.haSceneId) && (
            <span className="native-badge">Home Assistant</span>
          )}
        </div>
      </button>
      <div className="scene-actions">
        <button
          className={`scene-favorite icon-button ${scene.favorite ? "favorited" : ""}`}
          aria-label={`${scene.favorite ? "Unfavorite" : "Favorite"} ${scene.name}`}
          aria-pressed={scene.favorite}
          onClick={() => onFavorite(scene)}
        >
          <Heart size={16} fill={scene.favorite ? "currentColor" : "none"} />
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
      </div>
    </article>
  );
}
