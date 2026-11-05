import { useState } from "react";

export const themes = [
  {
    id: "firefly",
    name: "Firefly",
    description: "Warm glow on a dark background, like the app icon.",
    background: "#121511",
  },
  {
    id: "daylight",
    name: "Daylight",
    description: "Soft, light colors.",
    background: "#f8f7f4",
  },
] as const;
export type Theme = (typeof themes)[number]["id"];

const key = "glow-theme";

// The theme is a preference of this device, not of the home, so it lives in
// the browser rather than on the server. public/theme.js applies it on load.
export function savedTheme(): Theme {
  try {
    return localStorage.getItem(key) === "daylight" ? "daylight" : "firefly";
  } catch {
    return "firefly";
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "firefly") delete root.dataset.theme;
  else root.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      themes.find((option) => option.id === theme)!.background,
    );
}

export function useTheme() {
  const [theme, setTheme] = useState(savedTheme);
  const choose = (next: Theme) => {
    applyTheme(next);
    try {
      if (next === "firefly") localStorage.removeItem(key);
      else localStorage.setItem(key, next);
    } catch {
      // Without storage, the choice still lasts until the page reloads.
    }
    setTheme(next);
  };
  return [theme, choose] as const;
}
