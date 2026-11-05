import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Modal } from "./components";
import { plural } from "./format";
import type { Home, Light, Room } from "./types";

const suggestions = [
  "Living room",
  "Bedroom",
  "Kitchen",
  "Dining room",
  "Office",
  "Bathroom",
  "Hallway",
  "Kids room",
  "Garden",
];

export type RoomInput = { name: string; lightIds: string[] };

// Creates a room, or edits one: its name and which lights are in it. Like the
// Hue app, lights are picked from the whole home and move over when saved.
export function RoomDialog({
  home,
  room,
  initialLightIds = [],
  busy,
  errorMessage,
  onClose,
  onSave,
}: {
  home: Home;
  room?: Room;
  initialLightIds?: string[];
  busy: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSave: (input: RoomInput) => Promise<boolean>;
}) {
  const [name, setName] = useState(room?.name ?? "");
  const [selected, setSelected] = useState(
    () =>
      new Set(
        room
          ? home.lights.filter((l) => l.roomId === room.id).map((l) => l.id)
          : initialLightIds,
      ),
  );
  const [error, setError] = useState("");
  const roomNames = new Map(
    [...(home.areas ?? []), ...home.rooms].map((r) => [r.id, r.name]),
  );
  const taken = new Set(
    (home.areas ?? home.rooms).map((r) => r.name.toLowerCase()),
  );
  const ideas = suggestions
    .filter((idea) => !taken.has(idea.toLowerCase()))
    .slice(0, 6);
  // This room's lights first, then the rest of the home room by room.
  const sections = [
    ...(room ? [room.id] : []),
    ...home.rooms.map((r) => r.id).filter((id) => id !== room?.id),
  ]
    .map((roomId) => ({
      roomId,
      lights: home.lights.filter((l) => l.roomId === roomId),
    }))
    .filter((section) => section.lights.length);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function lockReason(light: Light) {
    if (light.movable === false) return "Needs a unique ID in Home Assistant";
    if (room && light.roomId === room.id && light.roomFromDevice)
      return "Its device is in this area in Home Assistant";
    return null;
  }
  function describe(light: Light) {
    const from = roomNames.get(light.roomId);
    const inRoom = room && light.roomId === room.id;
    if (selected.has(light.id))
      return inRoom || light.roomId === "unassigned"
        ? "In this room"
        : `Moves from ${from}`;
    if (inRoom) return "Leaves this room";
    return light.roomId === "unassigned" ? "No room yet" : `In ${from}`;
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) return setError("Give your room a name.");
    if (!room && !selected.size)
      return setError("Choose at least one light for this room.");
    if (await onSave({ name: name.trim(), lightIds: [...selected] })) onClose();
    else setError("Could not save the room. Please try again.");
  }

  return (
    <Modal
      title={room ? "Edit room" : "Create room"}
      subtitle={plural(selected.size, "light")}
      onClose={onClose}
      wide
    >
      <form onSubmit={save}>
        {home.mode === "live" && (
          <p className="help-note">
            Saved as an area in Home Assistant, so the room shows up there too.
          </p>
        )}
        <label className="field-label" htmlFor="room-name">
          Room name
        </label>
        <input
          id="room-name"
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Living room"
          required
          maxLength={50}
          autoFocus={!room}
        />
        {!room && ideas.length > 0 && (
          <div
            className="room-name-ideas"
            role="group"
            aria-label="Room name ideas"
          >
            {ideas.map((idea) => (
              <button
                type="button"
                key={idea}
                aria-pressed={name === idea}
                className={name === idea ? "selected" : ""}
                onClick={() => setName(idea)}
              >
                {idea}
              </button>
            ))}
          </div>
        )}
        <div className="field-heading">
          <span className="field-label">Lights</span>
          <span className="subtle">{selected.size} selected</span>
        </div>
        {sections.length ? (
          <div className="room-light-sections">
            {sections.map((section) => (
              <fieldset key={section.roomId} className="room-light-section">
                <legend>
                  {section.roomId === room?.id
                    ? "In this room"
                    : roomNames.get(section.roomId)}
                </legend>
                <div className="group-display-options">
                  {section.lights.map((light) => {
                    const locked = lockReason(light);
                    const checked = selected.has(light.id);
                    return (
                      <label
                        key={light.id}
                        className={`${checked ? "selected" : ""} ${locked ? "locked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy || Boolean(locked)}
                          onChange={() => toggle(light.id)}
                        />
                        <span>
                          <strong>{light.name}</strong>
                          <small>{locked ?? describe(light)}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        ) : (
          <p className="group-settings-note">
            Glow has not found any lights yet.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {errorMessage || error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {room ? "Save room" : "Create room"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
