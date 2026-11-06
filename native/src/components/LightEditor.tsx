import { Pressable, StyleSheet, View } from "react-native";
import { Check, Sun } from "lucide-react-native";
import {
  colorName,
  colorsClose,
  kelvinClose,
  plural,
  type Light,
  type LightGroup,
} from "../core";
import type { LightsAction } from "../glow";
import { useColors } from "../theme";
import { BulbIcon } from "./cards";
import { ColorWheel } from "./ColorWheel";
import { Sheet } from "./Sheet";
import { Brightness, WhiteSlider } from "./Slider";
import { Button, FieldLabel, Notice, Toggle, Txt } from "./ui";

const swatches = [
  "#f5bf76",
  "#f28e82",
  "#d888b7",
  "#afa0d6",
  "#83b5d5",
  "#9fc39a",
];
const whites = [
  { name: "Cozy", kelvin: 2200 },
  { name: "Warm", kelvin: 2700 },
  { name: "Fresh", kelvin: 4000 },
  { name: "Cool", kelvin: 6000 },
];

// The adjust dialog for a single light or a light group.
export function LightEditor({
  light,
  roomName,
  disabled,
  error,
  onChange,
  onClose,
}: {
  light: Light | LightGroup;
  roomName?: string;
  disabled: boolean;
  error?: string;
  onChange: LightsAction;
  onClose: () => void;
}) {
  const colors = useColors();
  const locked = disabled || !light.available;
  const supportedKelvin = (kelvin: number) =>
    Math.max(light.minKelvin, Math.min(light.maxKelvin, kelvin));
  // Bulbs report colors and temperatures slightly differently from what they
  // were sent, so match within tolerance. A white light's reported color is
  // only an approximation and never selects a swatch.
  const selectedColor =
    light.colorMode === "rgb"
      ? swatches.find((color) => colorsClose(light.color, color))
      : undefined;
  const selectedWhite =
    light.colorMode === "color_temp"
      ? whites.find((white) =>
          kelvinClose(light.kelvin, supportedKelvin(white.kelvin)),
        )
      : undefined;
  const whiteTint = [
    colors.whiteWarm,
    colors.whiteSoft,
    colors.whiteNeutral,
    colors.whiteCool,
  ];
  return (
    <Sheet
      title={light.name}
      subtitle={[
        roomName,
        "memberIds" in light ? plural(light.memberIds.length, "light") : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      onClose={onClose}
      footer={
        <Button
          label="Done"
          kind="primary"
          iconRight={Check}
          onPress={onClose}
        />
      }
    >
      <View
        style={[
          styles.power,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <BulbIcon light={light} group={"memberIds" in light} size={52} />
        <Txt size={15} weight="medium" style={{ flex: 1 }}>
          {light.available
            ? light.on
              ? "Looking bright"
              : "Taking a little rest"
            : "Light unavailable"}
        </Txt>
        <Toggle
          label="Light power"
          on={light.on}
          disabled={locked}
          onChange={() => onChange([light], { on: !light.on })}
        />
      </View>
      {error && <Notice kind="error">{error}</Notice>}
      {light.dimmable && (
        <View style={styles.section}>
          <FieldLabel>Brightness</FieldLabel>
          <Brightness
            value={light.on ? light.brightness : 0}
            onChange={(brightness) =>
              onChange([light], { brightness, on: true })
            }
            disabled={locked}
          />
        </View>
      )}
      {light.colorSupported && (
        <View style={styles.section}>
          <FieldLabel>A splash of color</FieldLabel>
          <ColorWheel
            color={light.color}
            white={light.colorMode === "color_temp"}
            label={`${light.name} color`}
            disabled={locked}
            onChange={(color) =>
              onChange([light], { color, colorMode: "rgb", on: true })
            }
          />
          <View style={styles.swatches}>
            {swatches.map((color) => {
              const selected = selectedColor === color;
              return (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={`Set color ${colorName(color)}`}
                  accessibilityState={{ selected, disabled: locked }}
                  disabled={locked}
                  onPress={() =>
                    onChange([light], { color, colorMode: "rgb", on: true })
                  }
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: color,
                      borderColor: selected ? colors.text : "transparent",
                      opacity: locked ? 0.45 : 1,
                    },
                  ]}
                >
                  {selected && (
                    <Check size={18} color="#2b2620" strokeWidth={2.5} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {light.temperatureSupported && (
        <View style={styles.section}>
          <FieldLabel>Or a softer shade of white</FieldLabel>
          <WhiteSlider
            value={supportedKelvin(light.kelvin)}
            min={light.minKelvin}
            max={light.maxKelvin}
            inactive={light.colorMode !== "color_temp"}
            disabled={locked}
            label={`${light.name} white temperature`}
            onChange={(kelvin) =>
              onChange([light], { kelvin, colorMode: "color_temp", on: true })
            }
          />
          <View style={styles.whites}>
            {whites.map((white, index) => {
              const kelvin = supportedKelvin(white.kelvin);
              const selected = selectedWhite === white;
              return (
                <Pressable
                  key={white.name}
                  accessibilityRole="button"
                  accessibilityLabel={white.name}
                  accessibilityState={{ selected, disabled: locked }}
                  disabled={locked}
                  onPress={() =>
                    onChange([light], {
                      kelvin,
                      colorMode: "color_temp",
                      on: true,
                    })
                  }
                  style={[
                    styles.white,
                    {
                      backgroundColor: whiteTint[index],
                      borderColor: selected
                        ? colors.borderSelected
                        : colors.border,
                      opacity: locked ? 0.45 : 1,
                    },
                  ]}
                >
                  <Sun
                    size={19}
                    color={selected ? colors.selectedInk : colors.glowInk}
                  />
                  <Txt size={12} weight="medium" tone="textSecondary">
                    {white.name}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  power: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  section: { gap: 12, marginTop: 6 },
  swatches: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  whites: { flexDirection: "row", gap: 8 },
  white: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
