import type { ReactNode } from "react";
import { ArrowRight, Heart, House, Lightbulb, Moon, Power } from "lucide-react";
import { plural } from "./format";
import { RoomCard } from "./RoomCard";
import type { Home, LightsAction, Scene } from "./types";

export type RoomFilter = "all" | "on";

export function RoomsPage({
  home,
  disabled,
  filter,
  onFilterChange,
  onOpenRoom,
  onShowScenes,
  onHelp,
  onLightsChange,
  renderScene,
}: {
  home: Home;
  disabled: boolean;
  filter: RoomFilter;
  onFilterChange: (filter: RoomFilter) => void;
  onOpenRoom: (roomId: string) => void;
  onShowScenes: () => void;
  onHelp: () => void;
  onLightsChange: LightsAction;
  renderScene: (scene: Scene, compact: boolean) => ReactNode;
}) {
  const lit = home.lights.filter((l) => l.on && l.available);
  const litRooms = new Set(lit.map((l) => l.roomId));
  const rooms = home.rooms.filter(
    (r) => filter === "all" || litRooms.has(r.id),
  );
  const favorites = home.scenes.filter((s) => s.favorite);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Rooms</h1>
        </div>
        <div className="home-actions">
          <div className="home-summary">
            <span className="summary-bulb">
              <Lightbulb size={23} strokeWidth={1.5} />
            </span>
            <div>
              <strong>{plural(lit.length, "light")} on</strong>
              <small>
                across{" "}
                {plural(
                  home.rooms.filter((r) => litRooms.has(r.id)).length,
                  "room",
                )}
              </small>
            </div>
          </div>
          <button
            className="button secondary all-off"
            disabled={disabled || !lit.length}
            onClick={() =>
              onLightsChange(
                home.lights.filter((l) => l.on),
                { on: false },
              )
            }
          >
            <Power size={15} />
            All lights off
          </button>
        </div>
      </div>
      <section className="section rooms-section">
        <div className="room-filters" role="group" aria-label="Filter rooms">
          <button
            className={filter === "all" ? "selected" : ""}
            onClick={() => onFilterChange("all")}
          >
            All rooms
          </button>
          <button
            className={filter === "on" ? "selected" : ""}
            onClick={() => onFilterChange("on")}
          >
            <span className="tiny-dot" />
            Lights on
          </button>
        </div>
        <div className="rooms-grid">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              lights={home.lights.filter((l) => l.roomId === room.id)}
              scenes={home.scenes}
              disabled={disabled}
              onOpen={onOpenRoom}
              onLightsChange={onLightsChange}
            />
          ))}
        </div>
        {!home.rooms.length ? (
          <div className="empty-state">
            <House size={32} />
            <h3>No rooms yet</h3>
            <p>
              Add lights to Areas in Home Assistant and they’ll appear here
              automatically. Unassigned lights appear in “Other lights”.
            </p>
            <button className="button secondary" onClick={onHelp}>
              How it works
            </button>
          </div>
        ) : (
          filter === "on" &&
          !lit.length && (
            <div className="empty-state">
              <Moon size={32} />
              <h3>All lights are off</h3>
              <p>Choose a room to turn on its lights.</p>
              <button
                className="text-button"
                onClick={() => onFilterChange("all")}
              >
                Show all rooms
                <ArrowRight size={15} />
              </button>
            </div>
          )
        )}
      </section>
      <section className="section favorites-section">
        <div className="section-heading">
          <h2>
            <Heart size={17} />
            Favorite scenes
          </h2>
          <button className="text-button" onClick={onShowScenes}>
            All scenes
            <ArrowRight size={15} />
          </button>
        </div>
        {favorites.length ? (
          <div className="favorites-grid">
            {favorites.map((s) => renderScene(s, true))}
          </div>
        ) : (
          <button className="empty-favorites" onClick={onShowScenes}>
            <Heart size={19} />
            <span>Tap the heart on a scene to keep it here.</span>
            <ArrowRight size={17} />
          </button>
        )}
      </section>
    </>
  );
}
