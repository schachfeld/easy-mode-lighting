import {
  Check,
  ExternalLink,
  House,
  Monitor,
  Moon,
  Radio,
  Sparkles,
  Sun,
} from "lucide-react";
import { Modal } from "./components";
import type { GlowClient } from "./platform/client";
import type { ThemePreference } from "./theme";
import type { Home } from "./types";

const themes = [
  { id: "system", name: "System", Icon: Monitor },
  { id: "light", name: "Light", Icon: Sun },
  { id: "dark", name: "Dark", Icon: Moon },
] as const;

export function ConnectionHelp({
  home,
  online = true,
  sceneStorage,
  theme,
  onThemeChange,
  onDisconnect,
  onClose,
}: {
  home: Home | null;
  online?: boolean;
  sceneStorage: GlowClient["sceneStorage"];
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onDisconnect?: () => void;
  onClose: () => void;
}) {
  const demo = home?.mode === "demo";
  const connected = Boolean(home?.connected && online);
  return (
    <Modal title="Settings & help" onClose={onClose}>
      <div
        className={`connection-info ${demo ? "demo" : connected ? "live" : "offline"}`}
      >
        <span className="connection-icon">
          <Radio size={22} />
        </span>
        <div>
          <strong>
            {demo
              ? "You’re exploring a demo home"
              : connected
                ? "Connected to Home Assistant"
                : "Waiting for Home Assistant"}
          </strong>
          <p>
            {demo
              ? "Everything here is interactive. Your real lights are not connected."
              : "Rooms, lights, and existing scenes sync automatically."}
          </p>
        </div>
      </div>
      <fieldset className="settings-group">
        <legend className="field-label">Appearance</legend>
        <div className="segmented theme-picker">
          {themes.map(({ id, name, Icon }) => (
            <label key={id} className={theme === id ? "selected" : ""}>
              <input
                type="radio"
                name="theme"
                value={id}
                checked={theme === id}
                onChange={() => onThemeChange(id)}
              />
              <Icon size={16} aria-hidden="true" />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      {demo && (
        <>
          <h3 className="help-heading">Connect to Home Assistant</h3>
          <ol className="setup-steps">
            <li>
              <span>1</span>
              <div>
                <strong>Install the Glow app</strong>
                <p>
                  Extract the Glow app package into your Home Assistant{" "}
                  <code>/local_apps</code> folder (called <code>/addons</code>{" "}
                  on older versions).
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Find it in the app store</strong>
                <p>
                  In Settings → Apps, open the app store, check for updates, and
                  install Glow from Local apps.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Start Glow</strong>
                <p>
                  Enable “Show in sidebar” and open Glow. Your existing rooms
                  and lights are ready to go.
                </p>
              </div>
            </li>
          </ol>
          <p className="help-note">
            On older versions, Apps is called Add-ons. No token, dashboard, or
            YAML setup is needed.
          </p>
        </>
      )}
      <div className="help-details">
        <div>
          <House size={18} />
          <p>
            <strong>Your rooms come from Home Assistant Areas.</strong> Lights
            without an Area appear in “Other lights”.
          </p>
        </div>
        <div>
          <Sparkles size={18} />
          <p>
            {demo ? (
              <>
                <strong>Demo scenes stay in Glow.</strong> Connect to Home
                Assistant to save scenes for your home.
              </>
            ) : (
              <>
                <strong>Scenes are saved in Home Assistant.</strong> New scenes
                are available on all devices and in automations. Save an older
                Glow scene to publish it. Favorites and Glow editor settings
                stay{" "}
                {sceneStorage === "device"
                  ? "on this device"
                  : "in this add-on"}
                .
              </>
            )}
          </p>
        </div>
      </div>
      <a
        className="help-docs"
        href="https://www.home-assistant.io/docs/organizing/"
        target="_blank"
        rel="noreferrer"
      >
        About rooms and Areas
        <ExternalLink size={14} />
      </a>
      <div className="modal-footer">
        {onDisconnect && (
          <button className="button secondary" onClick={onDisconnect}>
            Disconnect
          </button>
        )}
        <button className="button primary" onClick={onClose}>
          Done
          <Check size={16} />
        </button>
      </div>
    </Modal>
  );
}
