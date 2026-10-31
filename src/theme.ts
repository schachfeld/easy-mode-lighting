import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
const key = "glow-theme";
const query = "(prefers-color-scheme: dark)";
const background = { light: "#f6f5f0", dark: "#121311" };

export function readTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(key);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function resolve(preference: ThemePreference) {
  return preference === "system"
    ? window.matchMedia?.(query).matches
      ? "dark"
      : "light"
    : preference;
}

export function applyTheme(preference: ThemePreference) {
  const theme = resolve(preference);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", background[theme]);
}

// Follows the system unless the person picked a theme in settings.
export function useTheme() {
  const [preference, setPreference] = useState(readTheme);
  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system") return;
    const media = window.matchMedia?.(query);
    const update = () => applyTheme("system");
    media?.addEventListener("change", update);
    return () => media?.removeEventListener("change", update);
  }, [preference]);
  return [
    preference,
    (next: ThemePreference) => {
      try {
        if (next === "system") localStorage.removeItem(key);
        else localStorage.setItem(key, next);
      } catch {
        // Private browsing can refuse storage; the choice lasts this session.
      }
      setPreference(next);
    },
  ] as const;
}
