import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Heart,
  House,
  Lightbulb,
  LoaderCircle,
  Moon,
  Plus,
  Power,
  Radio,
  Settings2,
  Sparkles,
  Sun,
  X,
  Pencil,
  WifiOff,
  ExternalLink,
  LayoutGrid,
} from "lucide-react";
import { Brightness, Modal, RoomIcon, SceneOrb, Toggle } from "./components";
import { SceneEditor } from "./SceneEditor";
import type { Home, Light, LightSettings, Room, Scene } from "./types";

const endpoint = (path: string) =>
  new URL(`api/${path}`, new URL(".", window.location.href)).href;

function readRoute(): { page: "rooms" | "scenes"; roomId: string | null } {
  const [, page, id] = window.location.hash.slice(1).split("/");
  try {
    return {
      page: page === "scenes" ? "scenes" : "rooms",
      roomId: page === "rooms" && id ? decodeURIComponent(id) : null,
    };
  } catch {
    return { page: "rooms", roomId: null };
  }
}

function sceneMatches(scene: Scene, lights: Light[]) {
  const entries = Object.entries(scene.lights);
  return (
    entries.length > 0 &&
    entries.every(([id, settings]) => {
      const l = lights.find((l) => l.id === id);
      if (!l?.available || l.on !== settings.on) return false;
      if (!l.on) return true;
      return (
        (!l.dimmable || Math.abs(l.brightness - settings.brightness) <= 2) &&
        (settings.colorMode === "color_temp"
          ? !l.temperatureSupported ||
            Math.abs(
              l.kelvin -
                Math.max(l.minKelvin, Math.min(l.maxKelvin, settings.kelvin)),
            ) < 80
          : !l.colorSupported ||
            l.color.toLowerCase() === settings.color.toLowerCase())
      );
    })
  );
}

export default function App() {
  const [home, setHome] = useState<Home | null>(null);
  const [streamOnline, setStreamOnline] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState<"rooms" | "scenes">(() => readRoute().page);
  const [roomId, setRoomId] = useState<string | null>(() => readRoute().roomId);
  const [filter, setFilter] = useState("all");
  const [sceneFilter, setSceneFilter] = useState("all");
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [editor, setEditor] = useState<{
    roomId: string;
    scene?: Scene;
  } | null>(null);
  const [lightEditor, setLightEditor] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const updateRoute = () => {
      const next = readRoute();
      setPage(next.page);
      setRoomId(next.roomId);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);
  useEffect(() => {
    const events = new EventSource(endpoint("events"));
    events.onmessage = (event) => {
      try {
        setHome(JSON.parse(event.data));
        setStreamOnline(true);
        setLoadError("");
      } catch {
        setLoadError(
          "Glow received an unexpected response. Refresh to try again.",
        );
      }
    };
    events.onerror = () => {
      setStreamOnline(false);
      setLoadError("Connection interrupted. Reconnecting automatically…");
    };
    return () => events.close();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 8000 : 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const action = useCallback(
    async (
      path: string,
      body: object = {},
      method = "POST",
      success?: string,
    ) => {
      setBusy(true);
      try {
        const response = await fetch(endpoint(path), {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error ?? "Something went wrong. Please try again.",
          );
        if (success) setToast({ message: success, error: false });
        return true;
      } catch (error) {
        setToast({
          message:
            error instanceof Error
              ? error.message
              : "Could not complete that action.",
          error: true,
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  const lightsAction = (lights: Light[], settings: Partial<LightSettings>) =>
    action("lights", {
      ids: lights.filter((l) => l.available).map((l) => l.id),
      settings,
    });
  function navigate(next: "rooms" | "scenes", nextRoom: string | null = null) {
    window.location.hash = `/${next}${nextRoom ? `/${encodeURIComponent(nextRoom)}` : ""}`;
    setPage(next);
    setRoomId(nextRoom);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const room = home?.rooms.find((r) => r.id === roomId);
  const roomLights = home?.lights.filter((l) => l.roomId === roomId) ?? [];
  const lightsOn = home?.lights.filter((l) => l.on && l.available).length ?? 0;
  const disabled = busy || !home?.connected || !streamOnline;
  const currentLight = home?.lights.find((l) => l.id === lightEditor);

  function sceneCard(scene: Scene, compact = false) {
    const sceneRoom = home?.rooms.find((r) => r.id === scene.roomId);
    const active = home ? sceneMatches(scene, home.lights) : false;
    return (
      <article
        className={`scene-card ${compact ? "compact-scene" : ""} ${active ? "active" : ""}`}
        key={scene.id}
      >
        <button
          className="scene-activate"
          disabled={disabled}
          aria-label={`Activate ${scene.name} in ${sceneRoom?.name ?? "your home"}`}
          onClick={() =>
            action(
              `scenes/${encodeURIComponent(scene.id)}/activate`,
              {},
              "POST",
              `${scene.name} applied`,
            )
          }
        >
          <SceneOrb palette={scene.palette} />
          <div className="scene-text">
            <h3>{scene.name}</h3>
            <p>
              {room
                ? `${Object.keys(scene.lights).length || "Room"} lights`
                : (sceneRoom?.name ?? "Whole home")}
            </p>
          </div>
          {active && (
            <span className="scene-active-mark">
              <Check size={13} />
            </span>
          )}
        </button>
        <button
          className={`scene-favorite icon-button ${scene.favorite ? "favorited" : ""}`}
          aria-label={`${scene.favorite ? "Unfavorite" : "Favorite"} ${scene.name}`}
          aria-pressed={scene.favorite}
          disabled={busy}
          onClick={() =>
            action(`scenes/${encodeURIComponent(scene.id)}/favorite`, {
              favorite: !scene.favorite,
            })
          }
        >
          <Heart size={15} fill={scene.favorite ? "currentColor" : "none"} />
        </button>
        {!compact && scene.source === "glow" && (
          <button
            className="scene-edit icon-button"
            aria-label={`Edit ${scene.name}`}
            onClick={() => setEditor({ roomId: scene.roomId!, scene })}
          >
            <Pencil size={15} />
          </button>
        )}
        {!compact && scene.source === "home-assistant" && (
          <span className="native-badge">Home Assistant</span>
        )}
      </article>
    );
  }

  function roomCard(item: Room) {
    const lights = home!.lights.filter((l) => l.roomId === item.id);
    const on = lights.some((l) => l.on && l.available);
    const count = lights.filter((l) => l.on && l.available).length;
    const available = lights.filter((l) => l.available);
    const brightness = Math.round(
      lights.filter((l) => l.on).reduce((sum, l) => sum + l.brightness, 0) /
        (lights.filter((l) => l.on).length || 1),
    );
    const active = home!.scenes.find(
      (s) => s.roomId === item.id && sceneMatches(s, lights),
    );
    return (
      <article
        className={`room-card room-${item.style} ${on ? "room-on" : "room-off"}`}
        key={item.id}
      >
        <div className="room-info">
          <div className="room-card-heading">
            <button
              className="room-name"
              aria-label={`Open ${item.name}`}
              onClick={() => navigate("rooms", item.id)}
            >
              <span className="room-icon">
                <RoomIcon style={item.style} />
              </span>
              <span className="room-name-text">
                <h3>{item.name}</h3>
                <p>
                  {!available.length
                    ? "Lights unavailable"
                    : count
                      ? `${count} of ${lights.length} lights on`
                      : `${lights.length} lights · All off`}
                </p>
              </span>
              <ChevronRight size={16} />
            </button>
            <Toggle
              label={`${item.name} lights`}
              on={on}
              disabled={disabled || !available.length}
              onChange={() => lightsAction(lights, { on: !on })}
            />
          </div>
          {lights.some((l) => l.dimmable) && (
            <Brightness
              value={brightness || 50}
              label={`${item.name} brightness`}
              disabled={disabled || !available.length}
              compact
              onChange={(brightness) =>
                lightsAction(lights, { on: true, brightness })
              }
            />
          )}
          {on && active && <p className="room-active-scene">{active.name}</p>}
        </div>
      </article>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("rooms")}
          aria-label="Glow home"
        >
          <span className="brand-mark">
            <Sun size={25} strokeWidth={1.8} />
          </span>
          <span>
            glow<span className="brand-period">.</span>
          </span>
        </button>
        <div className="home-label">
          <span className="home-mini-icon">
            <House size={16} />
          </span>
          <div>My home</div>
        </div>
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${page === "rooms" ? "selected" : ""}`}
            onClick={() => navigate("rooms")}
          >
            <LayoutGrid size={19} />
            <span>Rooms</span>
            {home && <span className="nav-count">{home.rooms.length}</span>}
          </button>
          <button
            className={`nav-item ${page === "scenes" ? "selected" : ""}`}
            onClick={() => navigate("scenes")}
          >
            <Sparkles size={19} />
            <span>All scenes</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setConnectionOpen(true)}>
            <Settings2 size={18} />
            <span>Connection & help</span>
          </button>
          <div className="powered-by">
            <span
              className={`status-dot ${home?.connected && streamOnline ? "" : "offline"}`}
            />
            <span>Home Assistant</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <House size={15} />
            <span>My home</span>
            <ChevronRight size={13} />
            <span>
              {room ? room.name : page === "rooms" ? "Rooms" : "Scenes"}
            </span>
          </div>
          <button
            className={`connection-pill ${!home?.connected || !streamOnline ? "disconnected" : ""}`}
            onClick={() => setConnectionOpen(true)}
          >
            <span className="status-dot" />
            {home?.mode === "demo"
              ? "Demo home"
              : home?.connected && streamOnline
                ? "Home Assistant connected"
                : "Connecting…"}
            <ChevronRight size={12} />
          </button>
        </header>
        <main>
          {!home ? (
            <div className="loading-state">
              <Sun className="loading-sun" size={42} />
              <h1>Loading lights</h1>
              <p>{loadError || "Connecting to your home…"}</p>
              {loadError && (
                <button
                  className="button secondary"
                  onClick={() => location.reload()}
                >
                  Try again
                </button>
              )}
            </div>
          ) : (
            <>
              {(!home.connected || !streamOnline) && (
                <div className="connection-warning" role="status">
                  <WifiOff size={19} />
                  <div>
                    <strong>Reconnecting to your home</strong>
                    <p>
                      {home.error ||
                        loadError ||
                        "Controls will be available as soon as the connection is restored."}
                    </p>
                  </div>
                </div>
              )}
              {room ? (
                <>
                  <button
                    className="back-link"
                    onClick={() => navigate("rooms")}
                  >
                    <ArrowLeft size={16} />
                    All rooms
                  </button>
                  <div className={`room-detail-hero room-${room.style}`}>
                    <div className="room-detail-title">
                      <h1>{room.name}</h1>
                      <p>
                        {roomLights.filter((l) => l.on && l.available).length}{" "}
                        of {roomLights.length} lights on
                      </p>
                    </div>
                    <div className="room-detail-power">
                      <span>
                        {roomLights.some((l) => l.on && l.available)
                          ? "Lights on"
                          : "Lights off"}
                      </span>
                      <Toggle
                        label={`${room.name} all lights`}
                        on={roomLights.some((l) => l.on && l.available)}
                        disabled={
                          disabled || !roomLights.some((l) => l.available)
                        }
                        onChange={() =>
                          lightsAction(roomLights, {
                            on: !roomLights.some((l) => l.on && l.available),
                          })
                        }
                      />
                    </div>
                  </div>
                  {roomLights.some((l) => l.dimmable) && (
                    <div className="room-master-brightness">
                      <span>Room brightness</span>
                      <Brightness
                        value={
                          Math.round(
                            roomLights
                              .filter((l) => l.on && l.dimmable)
                              .reduce((sum, l) => sum + l.brightness, 0) /
                              (roomLights.filter((l) => l.on && l.dimmable)
                                .length || 1),
                          ) || 50
                        }
                        label="Room brightness"
                        disabled={
                          disabled || !roomLights.some((l) => l.available)
                        }
                        onChange={(brightness) =>
                          lightsAction(roomLights, { on: true, brightness })
                        }
                      />
                    </div>
                  )}
                  <section className="section">
                    <div className="section-heading">
                      <div>
                        <h2>
                          Lights{" "}
                          <span className="count-label">
                            {roomLights.length}
                          </span>
                        </h2>
                      </div>
                    </div>
                    <div className="lights-grid">
                      {roomLights.map((light) => (
                        <article
                          className={`light-card ${light.on ? "light-on" : ""}`}
                          key={light.id}
                        >
                          <div className="light-card-heading">
                            <button
                              className="light-name-button"
                              onClick={() => setLightEditor(light.id)}
                            >
                              <span
                                className="bulb-icon"
                                style={{
                                  color: light.on ? light.color : undefined,
                                }}
                              >
                                <Lightbulb size={23} strokeWidth={1.5} />
                              </span>
                              <span>
                                <h3>{light.name}</h3>
                                <small>
                                  {!light.available
                                    ? "Unavailable"
                                    : light.on
                                      ? light.colorMode === "color_temp"
                                        ? `${light.kelvin} K · White light`
                                        : "Color light"
                                      : "Off"}
                                </small>
                              </span>
                            </button>
                            <Toggle
                              label={`${light.name} power`}
                              on={light.on}
                              disabled={disabled || !light.available}
                              onChange={() =>
                                lightsAction([light], { on: !light.on })
                              }
                            />
                          </div>
                          {light.dimmable && (
                            <Brightness
                              value={light.brightness}
                              disabled={disabled || !light.available}
                              label={`${light.name} brightness`}
                              onChange={(brightness) =>
                                lightsAction([light], { brightness, on: true })
                              }
                              compact
                            />
                          )}
                          <button
                            className="light-adjust-link"
                            onClick={() => setLightEditor(light.id)}
                          >
                            Adjust light
                            <ChevronRight size={13} />
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                  <section className="section">
                    <div className="section-heading">
                      <div>
                        <h2>
                          Scenes{" "}
                          <span className="count-label">
                            {
                              home.scenes.filter((s) => s.roomId === room.id)
                                .length
                            }
                          </span>
                        </h2>
                      </div>
                      <button
                        className="button primary"
                        onClick={() => setEditor({ roomId: room.id })}
                      >
                        <Plus size={17} />
                        Create scene
                      </button>
                    </div>
                    <div className="scenes-grid">
                      {home.scenes
                        .filter((s) => s.roomId === room.id)
                        .map((s) => sceneCard(s))}
                    </div>
                  </section>
                </>
              ) : page === "rooms" ? (
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
                          <strong>{lightsOn} lights on</strong>
                          <small>
                            across{" "}
                            {
                              home.rooms.filter((r) =>
                                home.lights.some(
                                  (l) =>
                                    l.roomId === r.id && l.on && l.available,
                                ),
                              ).length
                            }{" "}
                            rooms
                          </small>
                        </div>
                      </div>
                      <button
                        className="button secondary all-off"
                        disabled={disabled || !lightsOn}
                        onClick={() =>
                          lightsAction(
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
                    <div
                      className="room-filters"
                      role="group"
                      aria-label="Filter rooms"
                    >
                      <button
                        className={filter === "all" ? "selected" : ""}
                        onClick={() => setFilter("all")}
                      >
                        All rooms
                      </button>
                      <button
                        className={filter === "on" ? "selected" : ""}
                        onClick={() => setFilter("on")}
                      >
                        <span className="tiny-dot" />
                        Lights on
                      </button>
                    </div>
                    <div className="rooms-grid">
                      {home.rooms
                        .filter(
                          (r) =>
                            filter === "all" ||
                            home.lights.some(
                              (l) => l.roomId === r.id && l.on && l.available,
                            ),
                        )
                        .map(roomCard)}
                    </div>
                    {!home.rooms.length ? (
                      <div className="empty-state">
                        <House size={32} />
                        <h3>No rooms yet</h3>
                        <p>
                          Add lights to Areas in Home Assistant and they’ll
                          appear here automatically. Unassigned lights appear in
                          “Other lights”.
                        </p>
                        <button
                          className="button secondary"
                          onClick={() => setConnectionOpen(true)}
                        >
                          How it works
                        </button>
                      </div>
                    ) : (
                      filter === "on" &&
                      !lightsOn && (
                        <div className="empty-state">
                          <Moon size={32} />
                          <h3>All lights are off</h3>
                          <p>Choose a room to turn on its lights.</p>
                          <button
                            className="text-button"
                            onClick={() => setFilter("all")}
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
                      <button
                        className="text-button"
                        onClick={() => navigate("scenes")}
                      >
                        All scenes
                        <ArrowRight size={15} />
                      </button>
                    </div>
                    {home.scenes.some((s) => s.favorite) ? (
                      <div className="favorites-grid">
                        {home.scenes
                          .filter((s) => s.favorite)
                          .map((s) => sceneCard(s, true))}
                      </div>
                    ) : (
                      <button
                        className="empty-favorites"
                        onClick={() => navigate("scenes")}
                      >
                        <Heart size={19} />
                        <span>Tap the heart on a scene to keep it here.</span>
                        <ArrowRight size={17} />
                      </button>
                    )}
                  </section>
                </>
              ) : (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>Scenes</h1>
                    </div>
                  </div>
                  <div className="section-heading scene-page-heading">
                    <div
                      className="room-filters"
                      role="group"
                      aria-label="Filter scenes"
                    >
                      <button
                        className={sceneFilter === "all" ? "selected" : ""}
                        onClick={() => setSceneFilter("all")}
                      >
                        All scenes
                      </button>
                      <button
                        className={
                          sceneFilter === "favorites" ? "selected" : ""
                        }
                        onClick={() => setSceneFilter("favorites")}
                      >
                        <Heart size={14} />
                        Favorites
                      </button>
                    </div>
                    <select
                      className="room-select"
                      aria-label="Scenes in room"
                      value={
                        ["all", "favorites"].includes(sceneFilter)
                          ? ""
                          : sceneFilter
                      }
                      onChange={(e) => setSceneFilter(e.target.value || "all")}
                    >
                      <option value="">Every room</option>
                      {home.rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="all-scenes-grid">
                    {home.scenes
                      .filter(
                        (s) =>
                          sceneFilter === "all" ||
                          (sceneFilter === "favorites"
                            ? s.favorite
                            : s.roomId === sceneFilter),
                      )
                      .map((s) => sceneCard(s))}
                  </div>
                  {!home.scenes.some(
                    (s) =>
                      sceneFilter === "all" ||
                      (sceneFilter === "favorites"
                        ? s.favorite
                        : s.roomId === sceneFilter),
                  ) && (
                    <div className="empty-state">
                      <Sparkles size={32} />
                      <h3>No scenes yet</h3>
                      <p>
                        {sceneFilter === "favorites"
                          ? "Tap the heart on any scene to make it a favorite."
                          : "Open a room to save your first scene."}
                      </p>
                      <button
                        className="button secondary"
                        onClick={() =>
                          sceneFilter === "favorites"
                            ? setSceneFilter("all")
                            : navigate("rooms")
                        }
                      >
                        {sceneFilter === "favorites"
                          ? "Explore scenes"
                          : "Go to rooms"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      {connectionOpen && (
        <Modal
          title="Connection & help"
          onClose={() => setConnectionOpen(false)}
        >
          <div
            className={`connection-info ${home?.mode === "live" ? "live" : ""}`}
          >
            <Radio size={23} />
            <div>
              <strong>
                {home?.mode === "demo"
                  ? "You’re exploring a demo home"
                  : home?.connected
                    ? "Connected to Home Assistant"
                    : "Waiting for Home Assistant"}
              </strong>
              <p>
                {home?.mode === "demo"
                  ? "Everything here is interactive. Your real lights are not connected."
                  : "Rooms, lights, and existing scenes sync automatically."}
              </p>
            </div>
          </div>
          {home?.mode === "demo" && (
            <>
              <h3 className="help-heading">Connect to Home Assistant</h3>
              <ol className="setup-steps">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Install the Glow app</strong>
                    <p>
                      Extract the Glow app package into your Home Assistant{" "}
                      <code>/local_apps</code> folder (called{" "}
                      <code>/addons</code> on older versions).
                    </p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Find it in the app store</strong>
                    <p>
                      In Settings → Apps, open the app store, check for updates,
                      and install Glow from Local apps.
                    </p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Start Glow</strong>
                    <p>
                      Enable “Show in sidebar” and open Glow. Your existing
                      rooms and lights are ready to go.
                    </p>
                  </div>
                </li>
              </ol>
              <p className="help-note">
                On older versions, Apps is called Add-ons. No token, dashboard,
                or YAML setup is needed.
              </p>
            </>
          )}
          <div className="help-details">
            <div>
              <House size={18} />
              <p>
                <strong>Your rooms come from Home Assistant Areas.</strong>{" "}
                Lights without an Area appear in “Other lights”.
              </p>
            </div>
            <div>
              <Sparkles size={18} />
              <p>
                <strong>Scenes sync across devices.</strong> Glow scenes are
                stored in the app and shared across your devices. Existing Home
                Assistant scenes appear too; edit those in Home Assistant.
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
            <button
              className="button primary"
              onClick={() => setConnectionOpen(false)}
            >
              Done
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {home && editor && home.rooms.some((r) => r.id === editor.roomId) && (
        <SceneEditor
          home={home}
          roomId={editor.roomId}
          scene={editor.scene}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={(body, id) =>
            action(
              id ? `scenes/${encodeURIComponent(id)}` : "scenes",
              body,
              id ? "PUT" : "POST",
              id ? "Scene updated" : "Scene saved",
            )
          }
          onDelete={(id) =>
            action(
              `scenes/${encodeURIComponent(id)}`,
              {},
              "DELETE",
              "Scene deleted",
            )
          }
        />
      )}
      {currentLight && (
        <Modal
          title={currentLight.name}
          subtitle={home?.rooms.find((r) => r.id === currentLight.roomId)?.name}
          onClose={() => setLightEditor(null)}
        >
          <div className="light-modal-power">
            <span
              className="bulb-icon"
              style={{
                color: currentLight.on ? currentLight.color : undefined,
              }}
            >
              <Lightbulb size={32} />
            </span>
            <span>
              {currentLight.available
                ? currentLight.on
                  ? "Looking bright"
                  : "Taking a little rest"
                : "Light unavailable"}
            </span>
            <Toggle
              label="Light power"
              on={currentLight.on}
              disabled={disabled || !currentLight.available}
              onChange={() =>
                lightsAction([currentLight], { on: !currentLight.on })
              }
            />
          </div>
          {toast?.error && (
            <p className="form-error" role="alert">
              {toast.message}
            </p>
          )}
          {currentLight.dimmable && (
            <>
              <span className="field-label">Brightness</span>
              <Brightness
                value={currentLight.brightness}
                onChange={(brightness) =>
                  lightsAction([currentLight], { brightness, on: true })
                }
                disabled={disabled || !currentLight.available}
              />
            </>
          )}
          {currentLight.colorSupported && (
            <>
              <div className="field-heading">
                <span className="field-label">A splash of color</span>
                <label className="color-picker">
                  <input
                    type="color"
                    value={currentLight.color}
                    aria-label="Custom light color"
                    disabled={disabled || !currentLight.available}
                    onChange={(e) =>
                      lightsAction([currentLight], {
                        color: e.target.value,
                        colorMode: "rgb",
                        on: true,
                      })
                    }
                  />
                  <span>Custom</span>
                </label>
              </div>
              <div className="color-swatches">
                {[
                  "#f5bf76",
                  "#f28e82",
                  "#d888b7",
                  "#afa0d6",
                  "#83b5d5",
                  "#9fc39a",
                ].map((color) => (
                  <button
                    key={color}
                    style={{ background: color }}
                    className={currentLight.color === color ? "selected" : ""}
                    aria-label={`Set color ${color}`}
                    disabled={disabled || !currentLight.available}
                    onClick={() =>
                      lightsAction([currentLight], {
                        color,
                        colorMode: "rgb",
                        on: true,
                      })
                    }
                  >
                    {currentLight.color === color && <Check size={17} />}
                  </button>
                ))}
              </div>
            </>
          )}
          {currentLight.temperatureSupported && (
            <>
              <div className="field-heading">
                <span className="field-label">Or a softer shade of white</span>
              </div>
              <div className="white-presets">
                {[
                  { name: "Cozy", k: 2200 },
                  { name: "Warm", k: 2700 },
                  { name: "Fresh", k: 4000 },
                  { name: "Cool", k: 6000 },
                ].map((p) => (
                  <button
                    key={p.name}
                    disabled={disabled || !currentLight.available}
                    className={
                      currentLight.colorMode === "color_temp" &&
                      currentLight.kelvin ===
                        Math.max(
                          currentLight.minKelvin,
                          Math.min(currentLight.maxKelvin, p.k),
                        )
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      lightsAction([currentLight], {
                        kelvin: Math.max(
                          currentLight.minKelvin,
                          Math.min(currentLight.maxKelvin, p.k),
                        ),
                        colorMode: "color_temp",
                        on: true,
                      })
                    }
                  >
                    <Sun size={19} />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="modal-footer">
            <button
              className="button primary"
              onClick={() => setLightEditor(null)}
            >
              Done
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-indicator" aria-label="Saving changes">
          <LoaderCircle size={16} />
        </div>
      )}
    </div>
  );
}
