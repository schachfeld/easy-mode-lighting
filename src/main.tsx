import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme, readTheme } from "./theme";
const MobileApp =
  import.meta.env.MODE === "mobile"
    ? lazy(() => import("./mobile/MobileApp"))
    : null;
import "@fontsource-variable/dm-sans";
import "./styles.css";

if (import.meta.env.MODE === "mobile")
  document.documentElement.classList.add("native-app");

// Apply the theme before the first paint, and follow the system when the
// person has not chosen one.
applyTheme(readTheme());
window
  .matchMedia?.("(prefers-color-scheme: dark)")
  .addEventListener?.("change", () => applyTheme(readTheme()));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {MobileApp ? (
      <Suspense
        fallback={
          <div className="loading-state">
            <p>Opening Glow…</p>
          </div>
        }
      >
        <MobileApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
