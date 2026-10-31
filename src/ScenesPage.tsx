import type { ReactNode } from "react";
import { Heart, Sparkles } from "lucide-react";
import { RoomIcon } from "./components";
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
  // Group by room, in the same order as the room list, then whole-home scenes.
  const groups = [
    ...home.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      style: room.style,
      scenes: scenes.filter((s) => s.roomId === room.id),
    })),
    {
      id: "home",
      name: "Whole home",
      style: "home",
      scenes: scenes.filter(
        (s) => !home.rooms.some((room) => room.id === s.roomId),
      ),
    },
  ].filter((group) => group.scenes.length);
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            {home.scenes.length} {home.scenes.length === 1 ? "scene" : "scenes"}{" "}
            · {home.scenes.filter((s) => s.favorite).length} favorites
          </p>
          <h1>Scenes</h1>
        </div>
      </header>
      <div className="scene-toolbar">
        <div className="segmented" role="group" aria-label="Filter scenes">
          <button
            className={filter === "all" ? "selected" : ""}
            aria-pressed={filter === "all"}
            onClick={() => onFilterChange("all")}
          >
            All scenes
          </button>
          <button
            className={filter === "favorites" ? "selected" : ""}
            aria-pressed={filter === "favorites"}
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
      {groups.map((group) => (
        <section className="scene-group" key={group.id} aria-label={group.name}>
          <h2>
            <span className="room-icon small">
              <RoomIcon style={group.style} size={16} />
            </span>
            {group.name}
            <span className="count-label">{group.scenes.length}</span>
          </h2>
          <div className="scenes-grid">
            {group.scenes.map((s) => renderScene(s))}
          </div>
        </section>
      ))}
      {!scenes.length && (
        <div className="empty-state">
          <span className="empty-icon">
            {filter === "favorites" ? (
              <Heart size={28} />
            ) : (
              <Sparkles size={28} />
            )}
          </span>
          <h3>
            {filter === "favorites" ? "No favorites yet" : "No scenes yet"}
          </h3>
          <p>
            {filter === "favorites"
              ? "Tap the heart on any scene. Favorites also appear on their room’s card for one-tap access."
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
