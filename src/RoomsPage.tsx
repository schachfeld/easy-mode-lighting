import type { CSSProperties } from "react";
import { ArrowRight, House, Moon, Power } from "lucide-react";
import { plural } from "./format";
import { litColors } from "./glow";
import { RoomCard } from "./RoomCard";
import type { Home, LightsAction, Scene } from "./types";

export type RoomFilter = "all" | "on";

function greeting(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function RoomsPage({
  home,
  disabled,
  filter,
  onFilterChange,
  onOpenRoom,
  onHelp,
  onLightsChange,
  onAllOff,
  onActivateScene,
}: {
  home: Home;
  disabled: boolean;
  filter: RoomFilter;
  onFilterChange: (filter: RoomFilter) => void;
  onOpenRoom: (roomId: string) => void;
  onHelp: () => void;
  onLightsChange: LightsAction;
  onAllOff: () => void;
  onActivateScene: (scene: Scene) => void;
}) {
  const lit = home.lights.filter((l) => l.on && l.available);
  const litRooms = new Set(lit.map((l) => l.roomId));
  const rooms = home.rooms.filter(
    (r) => filter === "all" || litRooms.has(r.id),
  );
  const [c1 = "transparent", c2 = c1, c3 = c2] = litColors(home.lights);
  return (
    <>
      <header className="page-heading home-heading">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1>Rooms</h1>
        </div>
        <div className="home-actions">
          <div
            className={`home-summary ${lit.length ? "is-on" : ""}`}
            style={{ "--c1": c1, "--c2": c2, "--c3": c3 } as CSSProperties}
          >
            <span className="summary-orb" aria-hidden="true" />
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
            onClick={onAllOff}
          >
            <Power size={16} />
            All lights off
          </button>
        </div>
      </header>
      <section className="section rooms-section" aria-label="Rooms">
        {home.rooms.length > 0 && (
          <div
            className="segmented room-filters"
            role="group"
            aria-label="Filter rooms"
          >
            <button
              className={filter === "all" ? "selected" : ""}
              aria-pressed={filter === "all"}
              onClick={() => onFilterChange("all")}
            >
              All rooms
            </button>
            <button
              className={filter === "on" ? "selected" : ""}
              aria-pressed={filter === "on"}
              onClick={() => onFilterChange("on")}
            >
              <span className="tiny-dot" />
              Lights on
            </button>
          </div>
        )}
        <div className="rooms-grid">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              lights={home.lights.filter((l) => l.roomId === room.id)}
              scenes={home.scenes}
              palettes={home.palettes}
              disabled={disabled}
              onOpen={onOpenRoom}
              onLightsChange={onLightsChange}
              onActivateScene={onActivateScene}
            />
          ))}
        </div>
        {!home.rooms.length ? (
          <div className="empty-state">
            <span className="empty-icon">
              <House size={28} />
            </span>
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
              <span className="empty-icon">
                <Moon size={28} />
              </span>
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
    </>
  );
}
