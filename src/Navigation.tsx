import {
  ChevronRight,
  LayoutGrid,
  Settings2,
  Sparkles,
  Sun,
} from "lucide-react";
import type { Home } from "./types";

export type Page = "rooms" | "scenes";

export function connectionLabel(home: Home | null, online: boolean) {
  if (home?.mode === "demo") return "Demo home";
  return home?.connected && online
    ? "Home Assistant connected"
    : "Connecting to Home Assistant";
}

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="Glow home">
      <span className="brand-mark">
        <Sun size={22} strokeWidth={2} />
      </span>
      <span className="brand-word">
        glow<span className="brand-period">.</span>
      </span>
    </button>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return <span className={`status-dot ${online ? "" : "offline"}`} />;
}

export function Sidebar({
  page,
  home,
  online,
  sceneCount,
  onNavigate,
  onSettings,
}: {
  page: Page;
  home: Home | null;
  online: boolean;
  sceneCount?: number;
  onNavigate: (page: Page) => void;
  onSettings: () => void;
}) {
  const label = connectionLabel(home, online);
  return (
    <aside className="sidebar">
      <Brand onClick={() => onNavigate("rooms")} />
      <nav aria-label="Main navigation">
        <button
          className={`nav-item ${page === "rooms" ? "selected" : ""}`}
          aria-current={page === "rooms" ? "page" : undefined}
          onClick={() => onNavigate("rooms")}
        >
          <LayoutGrid size={19} />
          <span>Rooms</span>
          {home && <span className="nav-count">{home.rooms.length}</span>}
        </button>
        <button
          className={`nav-item ${page === "scenes" ? "selected" : ""}`}
          aria-current={page === "scenes" ? "page" : undefined}
          onClick={() => onNavigate("scenes")}
        >
          <Sparkles size={19} />
          <span>Scenes</span>
          {sceneCount !== undefined && (
            <span className="nav-count">{sceneCount}</span>
          )}
        </button>
      </nav>
      <div className="sidebar-bottom">
        <button className="status-card" aria-label={label} onClick={onSettings}>
          <StatusDot online={Boolean(home?.connected && online)} />
          <span>
            <strong>
              {home?.mode === "demo"
                ? "Demo home"
                : home?.connected && online
                  ? "Connected"
                  : "Connecting…"}
            </strong>
            <small>
              {home?.mode === "demo" ? "Sample lights only" : "Home Assistant"}
            </small>
          </span>
          <ChevronRight size={15} />
        </button>
        <button className="nav-item" onClick={onSettings}>
          <Settings2 size={18} />
          <span>Settings & help</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileBar({
  home,
  online,
  onHome,
  onSettings,
}: {
  home: Home | null;
  online: boolean;
  onHome: () => void;
  onSettings: () => void;
}) {
  const connected = Boolean(home?.connected && online);
  return (
    <header className="mobile-bar">
      <Brand onClick={onHome} />
      <button
        className={`connection-pill ${connected ? "" : "disconnected"}`}
        aria-label={connectionLabel(home, online)}
        onClick={onSettings}
      >
        <StatusDot online={connected} />
        {home?.mode === "demo"
          ? "Demo home"
          : connected
            ? "Connected"
            : "Connecting…"}
      </button>
    </header>
  );
}

export function TabBar({
  page,
  onNavigate,
  onSettings,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  onSettings: () => void;
}) {
  return (
    <nav className="tab-bar" aria-label="Main navigation">
      <button
        className={page === "rooms" ? "selected" : ""}
        aria-current={page === "rooms" ? "page" : undefined}
        onClick={() => onNavigate("rooms")}
      >
        <LayoutGrid size={21} />
        <span>Rooms</span>
      </button>
      <button
        className={page === "scenes" ? "selected" : ""}
        aria-current={page === "scenes" ? "page" : undefined}
        onClick={() => onNavigate("scenes")}
      >
        <Sparkles size={21} />
        <span>Scenes</span>
      </button>
      <button onClick={onSettings}>
        <Settings2 size={21} />
        <span>Settings</span>
      </button>
    </nav>
  );
}
