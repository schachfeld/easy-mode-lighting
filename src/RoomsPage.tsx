import { ArrowRight, House, Lightbulb, Moon, Plus, Power } from "lucide-react";
import { plural } from "./format";
import { RoomCard } from "./RoomCard";
import type { Home, LightsAction } from "./types";

export type RoomFilter = "all" | "on";

export function RoomsPage({
  home,
  disabled,
  filter,
  onFilterChange,
  onOpenRoom,
  onHelp,
  onLightsChange,
  onAllOff,
  onCreateRoom,
}: {
  home: Home;
  disabled: boolean;
  filter: RoomFilter;
  onFilterChange: (filter: RoomFilter) => void;
  onOpenRoom: (roomId: string) => void;
  onHelp: () => void;
  onLightsChange: LightsAction;
  onAllOff: () => void;
  onCreateRoom: () => void;
}) {
  const lit = home.lights.filter((l) => l.on && l.available);
  const litRooms = new Set(lit.map((l) => l.roomId));
  const rooms = home.rooms.filter(
    (r) => filter === "all" || litRooms.has(r.id),
  );
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
            onClick={onAllOff}
          >
            <Power size={15} />
            All lights off
          </button>
        </div>
      </div>
      <section className="section rooms-section">
        <div className="rooms-toolbar">
          <div className="room-filters" role="group" aria-label="Filter rooms">
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
          <button
            className="button secondary"
            disabled={disabled}
            onClick={onCreateRoom}
          >
            <Plus size={15} />
            Create room
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
              Create a room and choose its lights. Lights in Home Assistant
              areas appear here automatically.
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
    </>
  );
}
