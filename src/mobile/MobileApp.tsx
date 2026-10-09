import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { ArrowRight, Lightbulb, LockKeyhole, Wifi } from "lucide-react";
import App from "../App";
import { connectMobile, type MobileClient } from "./client";
import {
  forgetConnection,
  hasSavedConnection,
  saveConnection,
  unlockConnection,
} from "./storage";
import {
  beginLogin,
  cancelLogin,
  listenForLogin,
  type AuthorizedAccount,
} from "./auth";
import { connectionUrl } from "../../packages/core/connection.mjs";

export default function MobileApp() {
  const [client, setClient] = useState<MobileClient | null>(null);
  const clientRef = useRef<MobileClient | null>(null);
  const pending = useRef<AbortController | null>(null);
  const [method, setMethod] = useState<"account" | "token">("account");
  const [authorizing, setAuthorizing] = useState(false);
  const [authorized, setAuthorized] = useState<AuthorizedAccount | null>(null);
  const acceptCallbacks = useRef(true);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(true);
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      hasSavedConnection()
        .then((value) => {
          if (active) setSaved(value);
        })
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
    setBusy(true);
    if (!saved && method === "account" && !authorized) {
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
    const controller = new AbortController();
    pending.current = controller;
    let next: MobileClient | undefined;
    try {
      if (
        !saved &&
        remember &&
        (password.length < 12 || password !== confirmation)
      )
        throw new Error(
          "Choose a passphrase of at least 12 characters and enter it identically in both fields.",
        );
      let connection;
      if (saved) {
        try {
          connection = await unlockConnection(password);
        } catch {
          throw new Error(
            "Could not unlock your connection. Check your passphrase, or forget the saved connection and set it up again.",
          );
        }
      } else
        connection = authorized?.connection ?? {
          url: connectionUrl(url),
          token: token.trim(),
        };
      if ("token" in connection && !connection.token)
        throw new Error("Enter a Home Assistant access token.");
      next = await connectMobile(
        connection,
        controller.signal,
        authorized?.grant,
      );
      if (!saved && remember) {
        await saveConnection(connection, password);
        setSaved(true);
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
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not connect. Please try again.",
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
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
      setSaved(false);
      setPassword("");
      setRemember(false);
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

  return (
    <main className="connect-page">
      <section className="connect-card" aria-labelledby="connect-title">
        <div className="connect-brand">
          <span>
            <Lightbulb size={26} />
          </span>{" "}
          glow
        </div>
        <div className="connect-art" aria-hidden="true">
          <div />
          <Lightbulb size={64} strokeWidth={1.2} />
        </div>
        <p className="eyebrow">YOUR HOME, IN A GOOD LIGHT</p>
        <h1 id="connect-title">
          {saved
            ? "Welcome home."
            : authorized
              ? "You’re signed in."
              : "A little closer to home."}
        </h1>
        <p className="connect-intro">
          {saved
            ? "Unlock your saved connection to bring your rooms and lights into view."
            : authorized
              ? "Choose whether to remember this sign-in, then open your home."
              : "Sign in with your Home Assistant account to bring your rooms and lights into view."}
        </p>
        <form onSubmit={connect}>
          {!saved && !authorized && (
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
          {!saved && (method === "token" || authorized) && (
            <label className="remember-row">
              <input
                type="checkbox"
                checked={remember}
                disabled={busy || checking}
                onChange={(e) => setRemember(e.target.checked)}
              />{" "}
              Remember this connection
            </label>
          )}
          {authorizing && (
            <p className="field-hint" role="status">
              Finish signing in in your browser. You’ll return to Glow
              automatically.
            </p>
          )}
          {(saved || (remember && (method === "token" || authorized))) && (
            <>
              <label htmlFor="vault-password">
                {saved ? "Vault passphrase" : "Create a vault passphrase"}
              </label>
              <input
                id="vault-password"
                type="password"
                autoComplete={saved ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={saved ? undefined : 12}
                required
                disabled={busy || checking}
              />
              {!saved && (
                <>
                  <label htmlFor="vault-confirmation">Confirm passphrase</label>
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
                <LockKeyhole size={14} /> Your connection is encrypted on this
                device. You’ll unlock it with this passphrase when you reopen
                Glow.
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
          {!saved && !authorized && !busy && (
            <button
              className="connect-secondary"
              type="button"
              disabled={checking}
              onClick={() => {
                setMethod(method === "account" ? "token" : "account");
                setRemember(false);
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
          {saved && (
            <button
              className="connect-secondary"
              type="button"
              disabled={busy || checking}
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
            Custom Glow scenes stay on this device.
          </p>
        </div>
      </section>
    </main>
  );
}
