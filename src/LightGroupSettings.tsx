import { useState } from "react";
import { Check } from "lucide-react";
import { Modal } from "./components";
import type { GroupDisplay, Light, LightGroup } from "./types";

export function LightGroupSettings({
  groups,
  lights,
  roomName,
  onClose,
  onChange,
  busy,
  deviceLocal,
}: {
  groups: LightGroup[];
  lights: Light[];
  roomName: string;
  onClose: () => void;
  onChange: (groupId: string, display: GroupDisplay) => Promise<boolean>;
  busy: boolean;
  deviceLocal: boolean;
}) {
  const [error, setError] = useState("");
  return (
    <Modal title="Customize lights" subtitle={roomName} onClose={onClose}>
      <p className="group-settings-intro">
        Choose how each group appears. Room controls and scenes still include
        the individual lights.
      </p>
      <div className="group-settings-list">
        {groups.map((group) => (
          <fieldset key={group.id} className="group-setting" disabled={busy}>
            <legend>{group.name}</legend>
            <p>
              {group.memberIds
                .map((id) => lights.find((light) => light.id === id)?.name)
                .join(" · ")}
            </p>
            <div className="group-display-options">
              {(
                [
                  [
                    "group",
                    "Show as a group",
                    "One control, with individual lights inside.",
                  ],
                  [
                    "individual",
                    "Show individual lights",
                    "Separate controls, without the group card.",
                  ],
                ] as const
              ).map(([display, title, description]) => (
                <label
                  key={display}
                  className={group.display === display ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name={`display-${group.id}`}
                    value={display}
                    checked={group.display === display}
                    onChange={async () => {
                      setError("");
                      if (!(await onChange(group.id, display)))
                        setError(
                          "Could not save your display preference. Please try again.",
                        );
                    }}
                  />
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="group-settings-note">
        {deviceLocal
          ? "Saved on this device for this home."
          : "Saved in Glow and shared by browsers using this home."}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-footer">
        <button className="button primary" onClick={onClose} disabled={busy}>
          Done
          <Check size={16} />
        </button>
      </div>
    </Modal>
  );
}
