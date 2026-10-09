export type LightSettings = {
  on: boolean;
  brightness: number;
  color: string;
  kelvin: number;
  colorMode: "rgb" | "color_temp";
};
export type Light = LightSettings & {
  id: string;
  name: string;
  roomId: string;
  available: boolean;
  dimmable: boolean;
  colorSupported: boolean;
  temperatureSupported: boolean;
  minKelvin: number;
  maxKelvin: number;
};
export type Room = { id: string; name: string; style: string };
export type GroupDisplay = "group" | "individual";
export type LightGroup = Light & {
  memberIds: string[];
  display: GroupDisplay;
};
export type Scene = {
  id: string;
  name: string;
  roomId: string | null;
  palette: string;
  favorite: boolean;
  source: "glow" | "home-assistant";
  lights: Record<string, LightSettings>;
};
export type Palette = {
  id: string;
  name: string;
  colors: string[];
  brightness: number;
  kelvin?: number;
};
export type Home = {
  rooms: Room[];
  lights: Light[];
  groups?: LightGroup[];
  scenes: Scene[];
  palettes: Palette[];
  mode: "demo" | "live";
  connected: boolean;
  error: string | null;
};
