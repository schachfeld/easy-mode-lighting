import { useState, type CSSProperties, type FormEvent } from "react";
import { Bookmark, Camera, Check, Plus, Trash2 } from "lucide-react";
import { displayColor } from "../packages/core/color.mjs";
import { Brightness, Modal, SceneOrb, Toggle } from "./components";
import { plural } from "./format";
import { fillPaint } from "./glow";
import { paletteColors, sceneColors } from "./scenes";
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
  errorMessage,
}: {
  home: Home;
  roomId: string;
  scene?: Scene;
  onClose: () => void;
  onSave: (data: object, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  busy: boolean;
  errorMessage?: string;
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
  const preview = sceneColors(
    { ...(scene ?? {}), palette, lights: settings } as Scene,
    home.palettes,
  );
  return (
    <Modal
      title={scene ? "Edit scene" : "Create scene"}
      subtitle={`${room.name} · ${plural(roomLights.length, "light")}`}
      onClose={onClose}
      wide
      className="scene-modal"
    >
      <form onSubmit={save}>
        <div className="scene-name-row">
          <SceneOrb colors={preview} size="medium" />
          <div className="scene-name-field">
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
          </div>
        </div>
        {home.mode === "live" && (
          <p className="help-note">
            Saved to Home Assistant and available in your automations.
          </p>
        )}
        <div className="field-heading">
          <span className="field-label">Start from a palette</span>
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
            <Camera size={15} />
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
              <SceneOrb colors={paletteColors(p)} size="small" />
              <span>{p.name}</span>
              {selectedMood === p.id && <Check size={14} strokeWidth={2.5} />}
            </button>
          ))}
        </div>
        <div className="field-heading">
          <span className="field-label">Lights</span>
          <span className="subtle">
            Your lights won’t change until you apply the scene
          </span>
        </div>
        <div className="scene-light-list">
          {roomLights.map((light) => {
            const current = settings[light.id];
            const color = displayColor({ ...light, ...current });
            return (
              <div
                className={`scene-light ${current.on ? "is-on" : ""}`}
                key={light.id}
                style={{ "--bulb": color } as CSSProperties}
              >
                <div className="scene-light-heading">
                  <span className="scene-light-dot" aria-hidden="true" />
                  <span className="scene-light-name">{light.name}</span>
                  <span className="subtle">{current.on ? "" : "Off"}</span>
                  <Toggle
                    label={`Include ${light.name} as on`}
                    on={current.on}
                    onChange={() => setLight(light.id, { on: !current.on })}
                  />
                </div>
                {current.on && (
                  <div className="scene-light-settings">
                    {light.dimmable && (
                      <Brightness
                        value={current.brightness}
                        label={`${light.name} scene brightness`}
                        paint={fillPaint([color])}
                        onChange={(brightness) =>
                          setLight(light.id, { brightness })
                        }
                        compact
                      />
                    )}
                    {(light.colorSupported || light.temperatureSupported) && (
                      <div className="color-controls">
                        {light.colorSupported && (
                          <label
                            className={`color-picker ${current.colorMode === "color_temp" && light.temperatureSupported ? "inactive" : ""}`}
                            title="Choose color"
                          >
                            <input
                              type="color"
                              aria-label={`${light.name} scene color`}
                              value={current.color}
                              onChange={(e) =>
                                setLight(light.id, {
                                  color: e.target.value,
                                  colorMode: "rgb",
                                })
                              }
                            />
                          </label>
                        )}
                        {light.temperatureSupported && (
                          <select
                            className={
                              current.colorMode === "color_temp"
                                ? ""
                                : "inactive"
                            }
                            aria-label={`${light.name} scene white temperature`}
                            value={
                              current.colorMode === "color_temp"
                                ? current.kelvin
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
                              White
                            </option>
                            {[
                              ...new Set([
                                light.minKelvin,
                                2700,
                                4000,
                                light.maxKelvin,
                                current.kelvin,
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
            );
          })}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {errorMessage || error}
          </p>
        )}
        <div className={`modal-footer ${deleteConfirm ? "confirming" : ""}`}>
          {deleteConfirm ? (
            <div className="delete-confirm" role="alert">
              <p>
                Delete “{scene?.name}”
                {scene?.haSceneId ? " from Home Assistant" : ""}? This cannot be
                undone.
              </p>
              <div>
                <button
                  type="button"
                  className="button secondary"
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
                      setError(
                        "The scene could not be deleted. Please try again.",
                      );
                  }}
                >
                  <Trash2 size={16} />
                  Delete scene
                </button>
              </div>
            </div>
          ) : (
            <>
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
              <button
                type="button"
                className="button secondary"
                onClick={onClose}
              >
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
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
