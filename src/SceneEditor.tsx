import { useState, type FormEvent } from "react";
import { Check, Lightbulb, Plus, Trash2, Bookmark } from "lucide-react";
import { Brightness, Modal, SceneOrb, Toggle } from "./components";
import type { Home, Light, LightSettings, Scene } from "./types";

export function snapshot(light: Light): LightSettings {
  return {
    on: light.on,
    brightness: light.brightness,
    color: light.color,
    kelvin: light.kelvin,
    colorMode: light.colorMode,
  };
}

export function SceneEditor({
  home,
  roomId,
  scene,
  onClose,
  onSave,
  onDelete,
  busy,
}: {
  home: Home;
  roomId: string;
  scene?: Scene;
  onClose: () => void;
  onSave: (data: object, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  busy: boolean;
}) {
  const room = home.rooms.find((r) => r.id === roomId)!;
  const roomLights = home.lights.filter((l) => l.roomId === roomId);
  const [name, setName] = useState(scene?.name ?? "");
  const [palette, setPalette] = useState(scene?.palette ?? "warm");
  const [selectedMood, setSelectedMood] = useState<string | null>(
    scene?.palette ?? null,
  );
  const [settings, setSettings] = useState<Record<string, LightSettings>>(() =>
    Object.fromEntries(
      roomLights.map((l) => [l.id, scene?.lights[l.id] ?? snapshot(l)]),
    ),
  );
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const setLight = (id: string, patch: Partial<LightSettings>) =>
    setSettings((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  function usePalette(id: string) {
    const p = home.palettes.find((p) => p.id === id)!;
    setPalette(id);
    setSelectedMood(id);
    setSettings(
      Object.fromEntries(
        roomLights.map((l, index) => [
          l.id,
          {
            on: true,
            brightness: p.brightness,
            color: p.colors[index % p.colors.length],
            kelvin: Math.max(
              l.minKelvin,
              Math.min(l.maxKelvin, p.kelvin ?? 2700),
            ),
            colorMode:
              p.kelvin && l.temperatureSupported ? "color_temp" : "rgb",
          },
        ]),
      ),
    );
    if (!name) setName(p.name);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (await onSave({ name, roomId, palette, lights: settings }, scene?.id))
      onClose();
    else setError("The scene could not be saved. Please try again.");
  }
  return (
    <Modal
      title={scene ? "Edit scene" : "Create scene"}
      subtitle={`${room.name} · ${roomLights.length} lights`}
      onClose={onClose}
      wide
    >
      <form onSubmit={save}>
        <label className="field-label" htmlFor="scene-name">
          Scene name
        </label>
        <input
          id="scene-name"
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Movie night"
          required
          maxLength={60}
          autoFocus
        />
        <div className="field-heading">
          <span className="field-label">Color presets</span>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setSelectedMood(null);
              setSettings(
                Object.fromEntries(roomLights.map((l) => [l.id, snapshot(l)])),
              );
            }}
          >
            Use current lights
          </button>
        </div>
        <div className="palette-grid">
          {home.palettes.map((p) => (
            <button
              type="button"
              key={p.id}
              aria-label={`Use ${p.name} palette`}
              aria-pressed={selectedMood === p.id}
              className={`palette-option ${selectedMood === p.id ? "selected" : ""}`}
              onClick={() => usePalette(p.id)}
            >
              <SceneOrb palette={p.id} small />
              <span>{p.name}</span>
              {selectedMood === p.id && <Check size={13} />}
            </button>
          ))}
        </div>
        <div className="field-heading">
          <span className="field-label">Lights</span>
          <span className="subtle">Changes are saved with the scene</span>
        </div>
        <div className="scene-light-list">
          {roomLights.map((light) => (
            <div className="scene-light" key={light.id}>
              <div className="scene-light-heading">
                <Lightbulb size={18} />
                <span>{light.name}</span>
                <Toggle
                  label={`Include ${light.name} as on`}
                  on={settings[light.id].on}
                  onChange={() =>
                    setLight(light.id, { on: !settings[light.id].on })
                  }
                />
              </div>
              {settings[light.id].on && (
                <div className="scene-light-settings">
                  {light.dimmable && (
                    <Brightness
                      value={settings[light.id].brightness}
                      label={`${light.name} scene brightness`}
                      onChange={(brightness) =>
                        setLight(light.id, { brightness })
                      }
                      compact
                    />
                  )}
                  {(light.colorSupported || light.temperatureSupported) && (
                    <div className="color-controls">
                      {light.colorSupported && (
                        <label className="color-picker" title="Choose color">
                          <input
                            type="color"
                            aria-label={`${light.name} scene color`}
                            value={settings[light.id].color}
                            onChange={(e) =>
                              setLight(light.id, {
                                color: e.target.value,
                                colorMode: "rgb",
                              })
                            }
                          />
                          <span>Color</span>
                        </label>
                      )}
                      {light.temperatureSupported && (
                        <select
                          aria-label={`${light.name} scene white temperature`}
                          value={
                            settings[light.id].colorMode === "color_temp"
                              ? settings[light.id].kelvin
                              : ""
                          }
                          onChange={(e) =>
                            setLight(light.id, {
                              kelvin: Number(e.target.value),
                              colorMode: "color_temp",
                            })
                          }
                        >
                          <option value="" disabled>
                            White light
                          </option>
                          {[
                            ...new Set([
                              light.minKelvin,
                              2700,
                              4000,
                              light.maxKelvin,
                              settings[light.id].kelvin,
                            ]),
                          ]
                            .filter(
                              (k) =>
                                k >= light.minKelvin && k <= light.maxKelvin,
                            )
                            .sort((a, b) => a - b)
                            .map((k) => (
                              <option key={k} value={k}>
                                {k} K
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          {scene && (
            <button
              type="button"
              className="icon-button danger"
              aria-label="Delete scene"
              onClick={() => setDeleteConfirm(true)}
              disabled={busy}
            >
              <Trash2 size={19} />
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy || !name.trim()}
            type="submit"
          >
            {scene ? <Bookmark size={17} /> : <Plus size={17} />}
            {busy ? "Saving…" : "Save scene"}
          </button>
        </div>
        {deleteConfirm && (
          <div className="delete-confirm" role="alert">
            <p>Delete “{scene?.name}”? This cannot be undone.</p>
            <button
              type="button"
              className="text-button"
              onClick={() => setDeleteConfirm(false)}
            >
              Keep scene
            </button>
            <button
              type="button"
              className="button danger-button"
              disabled={busy}
              onClick={async () => {
                if (scene && (await onDelete(scene.id))) onClose();
                else
                  setError("The scene could not be deleted. Please try again.");
              }}
            >
              Delete scene
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
