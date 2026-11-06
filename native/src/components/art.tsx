import { View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import {
  Armchair,
  Bath,
  BedDouble,
  CookingPot,
  Flower2,
  Monitor,
  Utensils,
  type LucideIcon,
} from "lucide-react-native";
import { roomTone, useColors } from "../theme";

// Three soft blobs of a palette's colors, like the web app's scene orbs.
const orbColors: Record<string, [string, string, string]> = {
  warm: ["#f7d48f", "#db9971", "#f4e6b3"],
  sunset: ["#f1c18a", "#d1839c", "#efac92"],
  ocean: ["#b7d6d2", "#8eaed1", "#88c4c4"],
  daylight: ["#fff5d5", "#cbd9df", "#e7e9dd"],
  forest: ["#d8d6a5", "#85aba0", "#b0c392"],
  night: ["#d0bce0", "#8396c1", "#baa4cd"],
};
const blobs = [
  { cx: 32.5, cy: 27.5 },
  { cx: 82.5, cy: 52.5 },
  { cx: 44.5, cy: 100.5 },
];

export function SceneOrb({
  palette,
  size = 64,
}: {
  palette: string;
  size?: number;
}) {
  const colors = orbColors[palette] ?? orbColors.warm;
  const id = `orb-${palette}`;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {colors.map((color, index) => (
            <RadialGradient key={index} id={`${id}-${index}`}>
              <Stop offset="0" stopColor={color} stopOpacity="1" />
              <Stop offset="0.55" stopColor={color} stopOpacity="0.95" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          ))}
          <RadialGradient id={`${id}-shine`} cx="30%" cy="22%" r="60%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill="#f1d19d" />
        {blobs.map((blob, index) => (
          <Circle
            key={index}
            cx={blob.cx}
            cy={blob.cy}
            r="56"
            fill={`url(#${id}-${index})`}
          />
        ))}
        <Circle cx="50" cy="50" r="50" fill={`url(#${id}-shine)`} />
      </Svg>
    </View>
  );
}

export const roomIcons: Record<string, LucideIcon> = {
  living: Armchair,
  bedroom: BedDouble,
  kitchen: CookingPot,
  office: Monitor,
  bathroom: Bath,
  dining: Utensils,
  garden: Flower2,
};

export function RoomIcon({
  style,
  size = 46,
}: {
  style: string;
  size?: number;
}) {
  const colors = useColors();
  const tone = roomTone(colors, style);
  const Icon = roomIcons[style] ?? Armchair;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        backgroundColor: tone.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={size * 0.5} color={tone.ink} strokeWidth={1.6} />
    </View>
  );
}
