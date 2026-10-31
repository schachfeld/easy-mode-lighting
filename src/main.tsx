import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { lazy, Suspense } from "react";
const MobileApp =
  import.meta.env.MODE === "mobile"
    ? lazy(() => import("./mobile/MobileApp"))
    : null;
import "@fontsource-variable/dm-sans";
import "./styles.css";

if (import.meta.env.MODE === "mobile")
  document.documentElement.classList.add("native-app");

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
