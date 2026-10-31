import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CircleAlert,
  LoaderCircle,
  RotateCcw,
  Sun,
  WifiOff,
  X,
} from "lucide-react";
import { lightTargets } from "../packages/core/groups.mjs";
import { ConnectionHelp } from "./ConnectionHelp";
import { plural } from "./format";
import { LightEditor } from "./LightEditor";
import { LightGroupSettings } from "./LightGroupSettings";
import { MobileBar, Sidebar, TabBar, type Page } from "./Navigation";
import { RoomPage } from "./RoomPage";
import { RoomsPage, type RoomFilter } from "./RoomsPage";
import { SceneCard } from "./SceneCard";
import { SceneEditor } from "./SceneEditor";
import { ScenesPage, type SceneFilter } from "./ScenesPage";
import { useTheme } from "./theme";
import type { Home, Light, LightSettings, Scene } from "./types";

import { serverClient, type GlowClient } from "./platform/client";
import { useLiveLights } from "./live";

type Toast = {
  message: string;
  error: boolean;
  action?: { label: string; run: () => void };
};

function readRoute(): { page: Page; roomId: string | null } {
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

// The settings that bring a light back exactly as it was.
function restoreSettings(light: Light): Partial<LightSettings> {
  return {
    on: true,
    ...(light.dimmable ? { brightness: light.brightness } : {}),
    ...(light.colorMode === "color_temp" && light.temperatureSupported
      ? { colorMode: "color_temp", kelvin: light.kelvin }
      : light.colorSupported
        ? { colorMode: "rgb", color: light.color }
        : {}),
  };
}

export default function App({
  client = serverClient,
  onDisconnect,
}: {
  client?: GlowClient;
  onDisconnect?: () => void;
}) {
  const [liveHome, setHome] = useState<Home | null>(null);
  const [streamOnline, setStreamOnline] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState<Page>(() => readRoute().page);
  const [roomId, setRoomId] = useState<string | null>(() => readRoute().roomId);
  const [filter, setFilter] = useState<RoomFilter>("all");
  const [sceneFilter, setSceneFilter] = useState<SceneFilter>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const [editor, setEditor] = useState<{
    roomId: string;
    scene?: Scene;
  } | null>(null);
  const [lightEditor, setLightEditor] = useState<string | null>(null);
  const [customizeRoom, setCustomizeRoom] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  // Only saving scenes and preferences blocks input. Light controls stay live.
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
    return client.subscribe(
      (next) => {
        setHome(next);
        setStreamOnline(true);
        setLoadError("");
      },
      (message) => {
        setStreamOnline(false);
        setLoadError(message);
      },
    );
  }, [client]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(null),
      toast.error ? 8000 : toast.action ? 7000 : 3500,
    );
    return () => clearTimeout(timer);
  }, [toast]);
  const showError = useCallback(
    (error: unknown) =>
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "Could not complete that action.",
        error: true,
      }),
    [],
  );
  const action = useCallback(
    async (
      path: string,
      body: object = {},
      method = "POST",
      success?: string,
      lock = true,
    ) => {
      if (lock) setBusy(true);
      try {
        await client.execute(method, path, body);
        if (success) setToast({ message: success, error: false });
        return true;
      } catch (error) {
        showError(error);
        return false;
      } finally {
        if (lock) setBusy(false);
      }
    },
    [client, showError],
  );
  const sendLights = useCallback(
    (ids: string[], settings: Partial<LightSettings>) =>
      client.execute("POST", "lights", { ids, settings }),
    [client],
  );
  const { home, control, predict } = useLiveLights(
    liveHome,
    sendLights,
    showError,
  );
  const lightsAction = (lights: Light[], settings: Partial<LightSettings>) => {
    if (!home) return Promise.resolve(false);
    const targets = lightTargets(
      home,
      lights.map((l) => l.id),
    ).filter((l) => l.available);
    return control(
      targets.map((l) => l.id),
      settings,
      [...targets, ...lights].map((l) => l.id),
    );
  };
  async function activateScene(scene: Scene) {
    const settle =
      scene.source === "glow"
        ? predict(Object.entries(scene.lights))
        : () => {};
    const ok = await action(
      `scenes/${encodeURIComponent(scene.id)}/activate`,
      {},
      "POST",
      `${scene.name} applied`,
      false,
    );
    settle(ok);
  }
  // Turning everything off is easy to do by accident, so offer an undo that
  // restores each light's brightness and color.
  async function allLightsOff() {
    if (!home) return;
    const lit = home.lights.filter((l) => l.on && l.available);
    if (!lit.length) return;
    const previous = lit.map((l) => [l.id, restoreSettings(l)] as const);
    if (!(await lightsAction(lit, { on: false }))) return;
    setToast({
      message: `Turned off ${plural(lit.length, "light")}`,
      error: false,
      action: {
        label: "Undo",
        run: () => {
          setToast(null);
          const batches = new Map<
            string,
            { ids: string[]; settings: Partial<LightSettings> }
          >();
          for (const [id, settings] of previous) {
            const key = JSON.stringify(settings);
            const batch = batches.get(key) ?? { ids: [], settings };
            batch.ids.push(id);
            batches.set(key, batch);
          }
          for (const batch of batches.values())
            control(batch.ids, batch.settings);
        },
      },
    });
  }
  function navigate(next: Page, nextRoom: string | null = null) {
    window.location.hash = `/${next}${nextRoom ? `/${encodeURIComponent(nextRoom)}` : ""}`;
    setPage(next);
    setRoomId(nextRoom);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const room = home?.rooms.find((r) => r.id === roomId);
  const disabled = !home?.connected || !streamOnline;
  const currentLight =
    home?.lights.find((l) => l.id === lightEditor) ??
    home?.groups?.find((group) => group.id === lightEditor);

  function renderScene(scene: Scene) {
    return (
      <SceneCard
        key={scene.id}
        scene={scene}
        home={home!}
        disabled={disabled}
        onActivate={activateScene}
        onFavorite={(scene) =>
          action(
            `scenes/${encodeURIComponent(scene.id)}/favorite`,
            { favorite: !scene.favorite },
            "POST",
            undefined,
            false,
          )
        }
        onEdit={(scene) => setEditor({ roomId: scene.roomId!, scene })}
      />
    );
  }

  const routeKey = room ? `room-${room.id}` : page;
  useEffect(() => {
    document.title = room
      ? `${room.name} · Glow`
      : page === "scenes"
        ? "Scenes · Glow"
        : "Glow · Your home, in a good light";
  }, [room?.name, page]);
  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        home={home}
        online={streamOnline}
        sceneCount={home?.scenes.length}
        onNavigate={(next) => navigate(next)}
        onSettings={() => setSettingsOpen(true)}
      />
      <MobileBar
        home={home}
        online={streamOnline}
        onHome={() => navigate("rooms")}
        onSettings={() => setSettingsOpen(true)}
      />
      <main>
        {!home ? (
          <div className="loading-state" role="status">
            <div className="loading-orb" aria-hidden="true">
              <Sun size={34} strokeWidth={1.6} />
            </div>
            <h1>
              {loadError ? "Can’t reach your home" : "Turning on the lights…"}
            </h1>
            <p>{loadError || "Connecting to your home."}</p>
            {loadError && (
              <button
                className="button secondary"
                onClick={() => location.reload()}
              >
                Try again
              </button>
            )}
            {!loadError && (
              <div className="skeleton-grid" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton-card" />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="page" key={routeKey}>
            {(!home.connected || !streamOnline) && (
              <div className="connection-warning" role="status">
                <WifiOff size={20} />
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
              <RoomPage
                home={home}
                room={room}
                disabled={disabled}
                onBack={() => navigate("rooms")}
                onLightsChange={lightsAction}
                onAdjustLight={setLightEditor}
                onCustomize={() => setCustomizeRoom(room.id)}
                onCreateScene={() => setEditor({ roomId: room.id })}
                renderScene={renderScene}
              />
            ) : page === "rooms" ? (
              <RoomsPage
                home={home}
                disabled={disabled}
                filter={filter}
                onFilterChange={setFilter}
                onOpenRoom={(id) => navigate("rooms", id)}
                onHelp={() => setSettingsOpen(true)}
                onLightsChange={lightsAction}
                onAllOff={allLightsOff}
                onActivateScene={activateScene}
              />
            ) : (
              <ScenesPage
                home={home}
                filter={sceneFilter}
                onFilterChange={setSceneFilter}
                onShowRooms={() => navigate("rooms")}
                renderScene={renderScene}
              />
            )}
          </div>
        )}
      </main>
      <TabBar
        page={page}
        onNavigate={(next) => navigate(next)}
        onSettings={() => setSettingsOpen(true)}
      />
      {home && customizeRoom && (
        <LightGroupSettings
          groups={
            home.groups?.filter((group) => group.roomId === customizeRoom) ?? []
          }
          lights={home.lights}
          roomName={
            home.rooms.find((item) => item.id === customizeRoom)?.name ?? ""
          }
          busy={busy}
          deviceLocal={client.sceneStorage === "device"}
          onClose={() => setCustomizeRoom(null)}
          onChange={(groupId, display) =>
            action("group-display", { groupId, display }, "PUT")
          }
        />
      )}
      {settingsOpen && (
        <ConnectionHelp
          home={home}
          online={streamOnline}
          sceneStorage={client.sceneStorage}
          theme={theme}
          onThemeChange={setTheme}
          onDisconnect={onDisconnect}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {home && editor && home.rooms.some((r) => r.id === editor.roomId) && (
        <SceneEditor
          home={home}
          roomId={editor.roomId}
          scene={editor.scene}
          busy={busy}
          errorMessage={toast?.error ? toast.message : undefined}
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
        <LightEditor
          light={currentLight}
          roomName={home?.rooms.find((r) => r.id === currentLight.roomId)?.name}
          disabled={disabled}
          error={toast?.error ? toast.message : undefined}
          onChange={lightsAction}
          onClose={() => setLightEditor(null)}
        />
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleAlert size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          {toast.action && (
            <button className="toast-action" onClick={toast.action.run}>
              <RotateCcw size={15} />
              {toast.action.label}
            </button>
          )}
          <button
            className="toast-dismiss"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-indicator" role="status">
          <LoaderCircle size={16} aria-hidden="true" />
          <span className="visually-hidden">Saving changes</span>
        </div>
      )}
    </div>
  );
}
