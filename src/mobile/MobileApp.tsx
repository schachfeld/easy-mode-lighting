import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { ArrowRight, Lightbulb, LockKeyhole, Wifi } from "lucide-react";
import App from "../App";
import { connectMobile, type MobileClient } from "./client";
import {
  forgetConnection,
  forgetVault,
  hasSavedConnection,
  loadSecureConnection,
  saveConnection,
  saveSecureConnection,
  secureStorageAvailable,
  unlockConnection,
  type Connection,
} from "./storage";
import {
  beginLogin,
  cancelLogin,
  listenForLogin,
  type AuthorizedAccount,
} from "./auth";
import type { AccessGrant } from "../../packages/core/auth.mjs";
import { connectionUrl } from "../../packages/core/connection.mjs";
// The add-on build has no src-tauri/, so use the copy of the app icon in public/.
const glowIcon = `${import.meta.env.BASE_URL}favicon.svg`;

const host = (connection: Connection) => {
  try {
    return new URL(connection.url).host;
  } catch {
    return connection.url;
  }
};

export default function MobileApp() {
  const [client, setClient] = useState<MobileClient | null>(null);
  const clientRef = useRef<MobileClient | null>(null);
  const pending = useRef<AbortController | null>(null);
  const [method, setMethod] = useState<"account" | "token">("account");
  const [authorizing, setAuthorizing] = useState(false);
  const [authorized, setAuthorized] = useState<AuthorizedAccount | null>(null);
  const acceptCallbacks = useRef(true);
  // Phones keep the sign-in in their secure storage. Elsewhere, an older
  // passphrase-protected vault remains available.
  const [secure, setSecure] = useState(false);
  const secureRef = useRef(false);
  const [saved, setSaved] = useState<Connection | null>(null);
  const [vault, setVault] = useState(false);
  const [checking, setChecking] = useState(true);
  const [url, setUrl] = useState("http://homeassistant.local:8123");
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Connects, optionally keeps the connection, then shows the home.
  const open = async (
    connection: Connection,
    options: {
      grant?: AccessGrant;
      keep?: "secure" | "vault" | "migrate";
      fromSaved?: boolean;
    } = {},
  ) => {
    setError("");
    setBusy(true);
    const controller = new AbortController();
    pending.current = controller;
    let next: MobileClient | undefined;
    try {
      next = await connectMobile(connection, controller.signal, options.grant);
      if (options.keep === "secure") {
        try {
          await saveSecureConnection(connection);
        } catch {
          throw new Error(
            "Could not save your sign-in on this device. Turn off “Stay signed in” to continue without saving it.",
          );
        }
        setSaved(connection);
      }
      if (options.keep === "migrate") {
        // Move an unlocked vault into secure storage, so the passphrase is
        // never needed again. If that fails, the vault keeps working.
        try {
          await saveSecureConnection(connection);
          await forgetVault();
          setSaved(connection);
          setVault(false);
        } catch {
          // Keep the vault.
        }
      }
      if (options.keep === "vault") {
        await saveConnection(connection, password);
        setVault(true);
      }
      if (controller.signal.aborted) {
        next.close();
        return;
      }
      clientRef.current = next;
      setClient(next);
      setToken("");
      setPassword("");
      setConfirmation("");
      setAuthorized(null);
    } catch (cause) {
      next?.close();
      if (controller.signal.aborted) return;
      const failure = cause as Error & { reauthenticate?: boolean };
      // A sign-in Home Assistant no longer accepts is of no use; forget it.
      if (options.fromSaved && failure?.reauthenticate) {
        await forgetConnection().catch(() => {});
        setSaved(null);
        setVault(false);
        setRemember(secureRef.current);
      }
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not connect. Please try again.",
      );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    const lifecycle = new AbortController();
    let removeListener: (() => void) | undefined;
    if (isTauri()) {
      listenForLogin(
        (account) => {
          if (!active || !acceptCallbacks.current) return;
          setAuthorized(account);
          setUrl(account.connection.url);
          setAuthorizing(false);
          setBusy(false);
          setError("");
        },
        (message) => {
          if (!active || !acceptCallbacks.current) return;
          setAuthorizing(false);
          setBusy(false);
          setError(message);
        },
        lifecycle.signal,
      )
        .then((remove) => {
          if (active) removeListener = remove;
          else remove();
        })
        .catch(() => {
          if (active)
            setError(
              "Could not listen for sign-in. Restart Glow to try again.",
            );
        });
      (async () => {
        const [available, hasVault] = await Promise.all([
          secureStorageAvailable().catch(() => false),
          hasSavedConnection(),
        ]);
        if (!active) return;
        secureRef.current = available;
        setSecure(available);
        setRemember(available);
        setVault(hasVault);
        if (!available) return;
        let connection: Connection | null = null;
        try {
          connection = await loadSecureConnection();
        } catch {
          // For example, a backup restored to a new phone cannot be decrypted.
          await forgetConnection().catch(() => {});
          setVault(false);
          if (active)
            setError(
              "Glow could not read your saved sign-in. Please sign in again.",
            );
        }
        if (!active || !connection) return;
        setSaved(connection);
        setChecking(false);
        // Open the home straight away, as a native app would.
        void open(connection, { fromSaved: true });
      })()
        .catch(() => {
          if (active)
            setError(
              "Could not check your saved connection. Restart Glow to try again.",
            );
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    } else setChecking(false);
    return () => {
      active = false;
      lifecycle.abort();
      removeListener?.();
      pending.current?.abort();
      clientRef.current?.close();
    };
  }, []);

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isTauri()) {
      setError(
        "This is the mobile interface preview. Open the installed Glow app to connect to your home.",
      );
      return;
    }
    setError("");
    if (saved) return open(saved, { fromSaved: true });
    if (vault) {
      let connection: Connection;
      try {
        connection = await unlockConnection(password);
      } catch {
        setError(
          "Could not unlock your connection. Check your passphrase, or forget the saved connection and set it up again.",
        );
        return;
      }
      return open(connection, { keep: secure ? "migrate" : undefined });
    }
    if (method === "account" && !authorized) {
      setBusy(true);
      try {
        acceptCallbacks.current = true;
        setAuthorizing(true);
        await beginLogin(url);
      } catch (cause) {
        setAuthorizing(false);
        setBusy(false);
        setError(
          cause instanceof Error ? cause.message : "Could not start sign-in.",
        );
      }
      return;
    }
    if (
      remember &&
      !secure &&
      (password.length < 12 || password !== confirmation)
    ) {
      setError(
        "Choose a passphrase of at least 12 characters and enter it identically in both fields.",
      );
      return;
    }
    let connection: Connection;
    try {
      connection = authorized?.connection ?? {
        url: connectionUrl(url),
        token: token.trim(),
      };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the address.");
      return;
    }
    if ("token" in connection && !connection.token) {
      setError("Enter a Home Assistant access token.");
      return;
    }
    return open(connection, {
      grant: authorized?.grant,
      keep: remember ? (secure ? "secure" : "vault") : undefined,
    });
  };

  const cancel = async () => {
    acceptCallbacks.current = false;
    pending.current?.abort();
    try {
      await cancelLogin();
    } catch {
      setError("Could not cancel sign-in. Please restart Glow.");
    }
    setAuthorized(null);
    setAuthorizing(false);
    setBusy(false);
  };

  const forget = async () => {
    setBusy(true);
    setError("");
    try {
      await forgetConnection();
      setSaved(null);
      setVault(false);
      setPassword("");
      setRemember(secure);
    } catch {
      setError("Could not forget the saved connection. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (client)
    return (
      <App
        client={client}
        onDisconnect={() => {
          client.close();
          clientRef.current = null;
          setClient(null);
          window.location.hash = "";
        }}
      />
    );

  const returning = Boolean(saved) || vault;
  return (
    <main className="connect-page">
      <section className="connect-card" aria-labelledby="connect-title">
        <div className="connect-brand">
          <img src={glowIcon} alt="" />
          glow
        </div>
        <div className="connect-art" aria-hidden="true">
          <div />
          <Lightbulb size={64} strokeWidth={1.2} />
        </div>
        <p className="eyebrow">YOUR HOME, IN A GOOD LIGHT</p>
        <h1 id="connect-title">
          {returning
            ? "Welcome home."
            : authorized
              ? "You’re signed in."
              : "A little closer to home."}
        </h1>
        <p className="connect-intro">
          {saved
            ? busy
              ? `Opening your home at ${host(saved)}…`
              : `Glow is signed in to ${host(saved)} on this device.`
            : vault
              ? "Unlock your saved connection to bring your rooms and lights into view."
              : authorized
                ? "Choose whether to stay signed in, then open your home."
                : "Sign in with your Home Assistant account to bring your rooms and lights into view."}
        </p>
        <form onSubmit={connect}>
          {!returning && !authorized && (
            <>
              <label htmlFor="ha-address">Home Assistant address</label>
              <input
                id="ha-address"
                type="url"
                inputMode="url"
                placeholder="http://homeassistant.local:8123"
                autoCapitalize="none"
                autoCorrect="off"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={busy || checking}
              />
              {method === "token" ? (
                <>
                  <label htmlFor="ha-token">Long-lived access token</label>
                  <input
                    id="ha-token"
                    type="password"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Paste your access token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    disabled={busy || checking}
                    aria-describedby="token-help"
                  />
                  <p id="token-help" className="field-hint">
                    Create a long-lived access token in your Home Assistant
                    profile, under Security. Use an account that can view your
                    rooms and control your lights.
                  </p>
                </>
              ) : (
                <p className="field-hint">
                  You’ll sign in securely on Home Assistant’s own page in your
                  browser. Glow never sees your password.
                </p>
              )}
            </>
          )}
          {authorized && (
            <p className="field-hint">
              Home Assistant: {authorized.connection.url}
            </p>
          )}
          {!returning && (method === "token" || authorized) && (
            <label className="remember-row">
              <input
                type="checkbox"
                checked={remember}
                disabled={busy || checking}
                onChange={(e) => setRemember(e.target.checked)}
              />{" "}
              {secure
                ? "Stay signed in on this device"
                : "Remember this connection"}
            </label>
          )}
          {!returning &&
            secure &&
            remember &&
            (method === "token" || authorized) && (
              <p className="field-hint">
                <LockKeyhole size={14} /> Your sign-in is kept in this device’s
                secure storage, so Glow opens your home straight away next time.
              </p>
            )}
          {authorizing && (
            <p className="field-hint" role="status">
              Finish signing in in your browser. You’ll return to Glow
              automatically.
            </p>
          )}
          {!saved &&
            (vault ||
              (!secure && remember && (method === "token" || authorized))) && (
              <>
                <label htmlFor="vault-password">
                  {vault ? "Vault passphrase" : "Create a vault passphrase"}
                </label>
                <input
                  id="vault-password"
                  type="password"
                  autoComplete={vault ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={vault ? undefined : 12}
                  required
                  disabled={busy || checking}
                />
                {!vault && (
                  <>
                    <label htmlFor="vault-confirmation">
                      Confirm passphrase
                    </label>
                    <input
                      id="vault-confirmation"
                      type="password"
                      autoComplete="new-password"
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      required
                      disabled={busy || checking}
                    />
                  </>
                )}
                <p className="field-hint">
                  <LockKeyhole size={14} />{" "}
                  {vault && secure
                    ? "Unlock once more, and Glow moves your sign-in to this device’s secure storage. You won’t need the passphrase again."
                    : "Your connection is encrypted on this device. You’ll unlock it with this passphrase when you reopen Glow."}
                </p>
              </>
            )}
          {error && (
            <p className="connect-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary connect-submit"
            disabled={busy || checking}
            type="submit"
          >
            {checking
              ? "Getting ready…"
              : authorizing
                ? "Waiting for sign-in…"
                : busy
                  ? "Connecting…"
                  : saved
                    ? "Open my home"
                    : vault
                      ? "Unlock & connect"
                      : authorized
                        ? "Open my home"
                        : method === "account"
                          ? "Sign in with Home Assistant"
                          : "Connect to my home"}
            <ArrowRight size={18} />
          </button>
          {busy && (
            <button
              className="button connect-secondary"
              type="button"
              onClick={cancel}
            >
              Cancel
            </button>
          )}
          {!returning && !authorized && !busy && (
            <button
              className="connect-secondary"
              type="button"
              disabled={checking}
              onClick={() => {
                setMethod(method === "account" ? "token" : "account");
                setRemember(secure);
                setError("");
                setToken("");
                setPassword("");
                setConfirmation("");
              }}
            >
              {method === "account"
                ? "Use an access token instead"
                : "Use account sign-in"}
            </button>
          )}
          {authorized && !busy && (
            <button
              className="connect-secondary"
              type="button"
              onClick={cancel}
            >
              Use a different account
            </button>
          )}
          {returning && !busy && (
            <button
              className="connect-secondary"
              type="button"
              disabled={checking}
              onClick={forget}
            >
              Forget saved connection
            </button>
          )}
        </form>
        <div className="connect-footnote">
          <Wifi size={18} />
          <p>
            Connect directly to your Home Assistant. No Glow add-on required.
            Save scenes to Home Assistant for use on all your devices.
          </p>
        </div>
      </section>
    </main>
  );
}
