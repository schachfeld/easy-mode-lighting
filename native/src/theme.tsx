import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// The same two themes as the web app. Firefly is the default: the night-time
// palette of the app icon. Daylight is the original light palette. Colors that
// show a light's own color stay the same in every theme.
const firefly = {
  bg: "#121511",
  bar: "#0e110e",
  surface: "#1a1e19",
  surfaceRaised: "#20251f",
  surfaceSunken: "#161a15",
  hover: "#252a23",
  selected: "#2f231b",
  selectedInk: "#f4a77c",
  border: "#2a3027",
  borderStrong: "#3c4338",
  borderSelected: "#b8603d",
  text: "#f1e8d8",
  textSecondary: "#c4b9a6",
  muted: "#a09886",
  faint: "#7d776b",
  leaf: "#eba66c",
  accent: "#df7855",
  accentDark: "#f09a6e",
  onAccent: "#1f0e07",
  okBg: "#182219",
  okBorder: "#2c3c2c",
  okInk: "#a6c48f",
  warnBg: "#2a2216",
  warnBorder: "#4a3b22",
  warnInk: "#e2b76e",
  warnInkStrong: "#f2cd8a",
  warnDot: "#d4a05a",
  statusOn: "#8fb07a",
  dangerInk: "#f2947a",
  dangerFill: "#b04e33",
  dangerOn: "#fff3ec",
  dangerBg: "#2d1914",
  dangerBorder: "#5a2b1f",
  toggleOn: "#df7855",
  toggleOff: "#3d4339",
  toggleOffBorder: "#6a7163",
  knob: "#f6ecdb",
  glowInk: "#f0b062",
  glowHalo: "#ffad4766",
  sliderFill: "#df7855",
  sliderTrack: "#30362d",
  thumbBorder: "#df7855",
  whiteWarm: "#2b2418",
  whiteSoft: "#29251e",
  whiteNeutral: "#222620",
  whiteCool: "#1d2427",
  backdrop: "#05060599",
  shadow: "#000000",
  rooms: {
    living: { bg: "#2e2418", ink: "#e7bf86" },
    bedroom: { bg: "#262335", ink: "#bdb2e4", on: "#9a8bcf" },
    kitchen: { bg: "#222a1d", ink: "#b6c99c" },
    dining: { bg: "#2e211c", ink: "#e5ab90", on: "#c98a6e" },
    office: { bg: "#1d2a2e", ink: "#a0c6cf" },
    bathroom: { bg: "#232820", ink: "#bac7aa" },
    garden: { bg: "#1f2a1c", ink: "#abce97" },
  } as Record<string, RoomTone>,
  statusBar: "light" as "light" | "dark",
};

const daylight: Colors = {
  bg: "#f8f7f4",
  bar: "#f0f0e9",
  surface: "#fdfcf9",
  surfaceRaised: "#fffefa",
  surfaceSunken: "#f2f2e9",
  hover: "#e8e9df",
  selected: "#e7ebdd",
  selectedInk: "#5f7149",
  border: "#e6e6dd",
  borderStrong: "#dadcd0",
  borderSelected: "#b3bd97",
  text: "#373b35",
  textSecondary: "#72766c",
  muted: "#8d9082",
  faint: "#a7aa98",
  leaf: "#7f906a",
  accent: "#df7855",
  accentDark: "#b84f30",
  onAccent: "#fffaf5",
  okBg: "#eff3e9",
  okBorder: "#dde4cf",
  okInk: "#7f8f69",
  warnBg: "#f6eedf",
  warnBorder: "#ebddc5",
  warnInk: "#ad8f5c",
  warnInkStrong: "#8e7e57",
  warnDot: "#b8925c",
  statusOn: "#849b72",
  dangerInk: "#ad6550",
  dangerFill: "#bc745f",
  dangerOn: "#fff7f2",
  dangerBg: "#f8ebe4",
  dangerBorder: "#eed6c7",
  toggleOn: "#b9935d",
  toggleOff: "#c1c5b8",
  toggleOffBorder: "#b8bdaa",
  knob: "#fefdf7",
  glowInk: "#c2ab78",
  glowHalo: "#f8db99",
  sliderFill: "#b5bd98",
  sliderTrack: "#e8e9df",
  thumbBorder: "#b3bb94",
  whiteWarm: "#f5f0df",
  whiteSoft: "#f7f3e8",
  whiteNeutral: "#f2f3ef",
  whiteCool: "#edf1f3",
  backdrop: "#333a3260",
  shadow: "#2c3527",
  rooms: {
    living: { bg: "#f0dfc8", ink: "#a88961" },
    bedroom: { bg: "#deddec", ink: "#9187a9", on: "#a79abb" },
    kitchen: { bg: "#e5e8dc", ink: "#8d9b7d" },
    dining: { bg: "#eddbd4", ink: "#b08b79", on: "#bb937f" },
    office: { bg: "#dfe6e8", ink: "#889ca2" },
    bathroom: { bg: "#e4e6df", ink: "#919c8a" },
    garden: { bg: "#dfe6d4", ink: "#819878" },
  },
  statusBar: "dark",
};

export type RoomTone = { bg: string; ink: string; on?: string };
export type Colors = typeof firefly;

export const themes = [
  {
    id: "firefly",
    name: "Firefly",
    description: "Warm glow on a dark background, like the app icon.",
    colors: firefly,
  },
  {
    id: "daylight",
    name: "Daylight",
    description: "Soft, light colors.",
    colors: daylight,
  },
] as const;
export type ThemeId = (typeof themes)[number]["id"];

export const fonts = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semibold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
};

const key = "glow-theme";
const ThemeContext = createContext<{
  theme: ThemeId;
  colors: Colors;
  setTheme: (theme: ThemeId) => void;
}>({ theme: "firefly", colors: firefly, setTheme: () => {} });

// The theme is a preference of this device, not of the home.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("firefly");
  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((value) => {
        if (value === "daylight") setThemeState("daylight");
      })
      .catch(() => {});
  }, []);
  // Native views (the Liquid Glass tab bar, the keyboard, system alerts) follow
  // the system appearance, so match it to the theme rather than the device.
  useEffect(() => {
    Appearance.setColorScheme(theme === "firefly" ? "dark" : "light");
  }, [theme]);
  const value = useMemo(
    () => ({
      theme,
      colors: themes.find((option) => option.id === theme)!.colors,
      setTheme(next: ThemeId) {
        setThemeState(next);
        (next === "firefly"
          ? AsyncStorage.removeItem(key)
          : AsyncStorage.setItem(key, next)
        ).catch(() => {
          // Without storage, the choice still lasts until Glow restarts.
        });
      },
    }),
    [theme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;
export const roomTone = (colors: Colors, style: string): RoomTone =>
  colors.rooms[style] ?? colors.rooms.living;
