import type { ReactNode } from "react";
import { Heart, Sparkles } from "lucide-react";
import type { Home, Scene } from "./types";

// "all", "favorites", or a room id.
export type SceneFilter = string;

export function ScenesPage({
  home,
  filter,
  onFilterChange,
  onShowRooms,
  renderScene,
}: {
  home: Home;
  filter: SceneFilter;
  onFilterChange: (filter: SceneFilter) => void;
  onShowRooms: () => void;
  renderScene: (scene: Scene) => ReactNode;
}) {
  const scenes = home.scenes.filter(
    (s) =>
      filter === "all" ||
      (filter === "favorites" ? s.favorite : s.roomId === filter),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Scenes</h1>
        </div>
      </div>
      <div className="section-heading scene-page-heading">
        <div className="room-filters" role="group" aria-label="Filter scenes">
          <button
            className={filter === "all" ? "selected" : ""}
            onClick={() => onFilterChange("all")}
          >
            All scenes
          </button>
          <button
            className={filter === "favorites" ? "selected" : ""}
            onClick={() => onFilterChange("favorites")}
          >
            <Heart size={14} />
            Favorites
          </button>
        </div>
        <select
          className="room-select"
          aria-label="Scenes in room"
          value={["all", "favorites"].includes(filter) ? "" : filter}
          onChange={(e) => onFilterChange(e.target.value || "all")}
        >
          <option value="">Every room</option>
          {home.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="all-scenes-grid">{scenes.map((s) => renderScene(s))}</div>
      {!scenes.length && (
        <div className="empty-state">
          <Sparkles size={32} />
          <h3>No scenes yet</h3>
          <p>
            {filter === "favorites"
              ? "Tap the heart on any scene to make it a favorite."
              : "Open a room to save your first scene."}
          </p>
          <button
            className="button secondary"
            onClick={() =>
              filter === "favorites" ? onFilterChange("all") : onShowRooms()
            }
          >
            {filter === "favorites" ? "Explore scenes" : "Go to rooms"}
          </button>
        </div>
      )}
    </>
  );
}
