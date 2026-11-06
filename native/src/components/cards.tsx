import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
  Layers,
  Lightbulb,
  Pencil,
} from "lucide-react-native";
import {
  averageBrightness,
  sliderTargets,
  colorName,
  plural,
  sceneMatches,
  whiteName,
  type Home,
  type Light,
  type LightGroup,
  type Room,
  type Scene,
} from "../core";
import type { LightsAction } from "../glow";
import { roomTone, useColors } from "../theme";
import { RoomIcon, SceneOrb } from "./art";
import { Brightness } from "./Slider";
import { Card, IconButton, Toggle, ToggleColor, Txt } from "./ui";

export function RoomCard({
  room,
  lights,
  scenes,
  disabled,
  onOpen,
  onLightsChange,
}: {
  room: Room;
  // The lights in this room.
  lights: Light[];
  scenes: Scene[];
  disabled: boolean;
  onOpen: (roomId: string) => void;
  onLightsChange: LightsAction;
}) {
  const colors = useColors();
  const count = lights.filter((l) => l.on && l.available).length;
  const on = count > 0;
  const anyAvailable = lights.some((l) => l.available);
  const active = scenes.find(
    (s) => s.roomId === room.id && sceneMatches(s, lights),
  );
  return (
    <ToggleColor.Provider value={roomTone(colors, room.style).on}>
      <Card style={styles.roomCard}>
        <View style={styles.heading}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${room.name}`}
            onPress={() => onOpen(room.id)}
            style={({ pressed }) => [
              styles.roomName,
              pressed && { opacity: 0.7 },
            ]}
          >
            <RoomIcon style={room.style} />
            <View style={{ flex: 1 }}>
              <Txt size={17} weight="semibold">
                {room.name}
              </Txt>
              <Txt size={12} tone="muted" style={{ marginTop: 3 }}>
                {!anyAvailable
                  ? "Lights unavailable"
                  : count
                    ? `${count} of ${plural(lights.length, "light")} on`
                    : `${plural(lights.length, "light")} · All off`}
              </Txt>
            </View>
            <ChevronRight size={18} color={colors.faint} />
          </Pressable>
          <Toggle
            label={`${room.name} lights`}
            on={on}
            disabled={disabled || !anyAvailable}
            onChange={() => onLightsChange(lights, { on: !on })}
          />
        </View>
        {lights.some((l) => l.dimmable) && (
          <View style={!on && { opacity: 0.7 }}>
            <Brightness
              value={on ? averageBrightness(lights) : 0}
              label={`${room.name} brightness`}
              disabled={disabled || !anyAvailable}
              compact
              onChange={(brightness) =>
                onLightsChange(sliderTargets(lights), {
                  on: true,
                  brightness,
                })
              }
            />
          </View>
        )}
        {on && active && (
          <Txt size={12} tone="textSecondary">
            {active.name}
          </Txt>
        )}
      </Card>
    </ToggleColor.Provider>
  );
}

// "2700 K · Warm white", "Coral", or just "On" for bulbs without color.
export function lightDescription(light: Light) {
  if (!light.available) return "Unavailable";
  if (!light.on) return "Off";
  if (light.colorMode === "color_temp" && light.temperatureSupported)
    return `${light.kelvin} K · ${whiteName(light.kelvin)}`;
  return light.colorSupported ? colorName(light.color) : "On";
}

export function BulbIcon({
  light,
  group = false,
  size = 44,
}: {
  light: Light;
  group?: boolean;
  size?: number;
}) {
  const colors = useColors();
  const Icon = group ? Layers : Lightbulb;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: light.on ? colors.surfaceRaised : colors.surfaceSunken,
        borderWidth: 1,
        borderColor: light.on ? `${light.color}66` : colors.border,
      }}
    >
      <Icon
        size={size * 0.5}
        color={light.on ? light.color : colors.faint}
        strokeWidth={1.5}
      />
    </View>
  );
}

export function LightCard({
  light,
  members,
  disabled,
  onChange,
  onAdjust,
  nested = false,
}: {
  light: Light | LightGroup;
  members?: Light[];
  disabled: boolean;
  onChange: LightsAction;
  onAdjust: (id: string) => void;
  nested?: boolean;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const onCount =
    members?.filter((member) => member.available && member.on).length ?? 0;
  return (
    <Card
      style={[
        styles.lightCard,
        nested && { backgroundColor: colors.surfaceSunken },
      ]}
    >
      <View style={styles.heading}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Adjust ${light.name}`}
          onPress={() => onAdjust(light.id)}
          style={({ pressed }) => [
            styles.roomName,
            pressed && { opacity: 0.7 },
          ]}
        >
          <BulbIcon light={light} group={Boolean(members)} />
          <View style={{ flex: 1 }}>
            <Txt size={16} weight="semibold">
              {light.name}
            </Txt>
            <Txt size={12} tone="muted" style={{ marginTop: 3 }}>
              {members
                ? `${plural(members.length, "light")} · ${onCount} on${members.some((member) => !member.available) ? " · Some unavailable" : ""}`
                : lightDescription(light)}
            </Txt>
          </View>
        </Pressable>
        <Toggle
          label={`${light.name} power`}
          on={light.on}
          disabled={disabled || !light.available}
          onChange={() => onChange(members ?? [light], { on: !light.on })}
        />
      </View>
      {light.dimmable && (
        <Brightness
          value={light.on ? light.brightness : 0}
          disabled={disabled || !light.available}
          label={`${light.name} brightness`}
          compact
          onChange={(brightness) =>
            onChange(members ? sliderTargets(members) : [light], {
              brightness,
              on: true,
            })
          }
        />
      )}
      <View style={styles.cardLinks}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onAdjust(light.id)}
          hitSlop={8}
          style={styles.link}
        >
          <Txt size={13} weight="medium" tone="accentDark">
            {members ? "Adjust group" : "Adjust light"}
          </Txt>
          <ChevronRight size={14} color={colors.accentDark} />
        </Pressable>
        {members && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Individual lights in ${light.name}`}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            hitSlop={8}
            style={styles.link}
          >
            <Txt size={13} weight="medium" tone="textSecondary">
              Individual lights · {members.length}
            </Txt>
            <ChevronDown
              size={14}
              color={colors.textSecondary}
              style={expanded && { transform: [{ rotate: "180deg" }] }}
            />
          </Pressable>
        )}
      </View>
      {members && expanded && (
        <View style={{ gap: 10 }}>
          {members.map((member) => (
            <LightCard
              key={member.id}
              light={member}
              disabled={disabled}
              onChange={onChange}
              onAdjust={onAdjust}
              nested
            />
          ))}
        </View>
      )}
    </Card>
  );
}

export function SceneCard({
  scene,
  home,
  inRoom,
  disabled,
  onActivate,
  onFavorite,
  onEdit,
}: {
  scene: Scene;
  home: Home;
  // Inside a room the room name is redundant, so show what the scene covers.
  inRoom: boolean;
  disabled: boolean;
  onActivate: (scene: Scene) => void;
  onFavorite: (scene: Scene) => void;
  onEdit: (scene: Scene) => void;
}) {
  const colors = useColors();
  const sceneRoom = home.rooms.find((r) => r.id === scene.roomId);
  const active = sceneMatches(scene, home.lights);
  const lightCount = Object.keys(scene.lights).length;
  return (
    <Card
      style={[
        styles.sceneCard,
        active && {
          borderColor: colors.borderSelected,
          backgroundColor: colors.selected,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Activate ${scene.name} in ${sceneRoom?.name ?? "your home"}`}
        accessibilityState={{ disabled, selected: active }}
        disabled={disabled}
        onPress={() => onActivate(scene)}
        style={({ pressed }) => [
          styles.sceneActivate,
          { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
        ]}
      >
        <View>
          <SceneOrb palette={scene.palette} size={58} />
          {active && (
            <View
              style={[
                styles.activeMark,
                { backgroundColor: colors.accent, borderColor: colors.bg },
              ]}
            >
              <Check size={12} color={colors.onAccent} strokeWidth={3} />
            </View>
          )}
        </View>
        <View style={{ gap: 3 }}>
          <Txt size={15} weight="semibold" numberOfLines={2}>
            {scene.name}
          </Txt>
          <Txt size={12} tone="muted" numberOfLines={1}>
            {inRoom
              ? // Home Assistant scenes without Glow settings list no lights.
                lightCount
                ? plural(lightCount, "light")
                : "Room lights"
              : (sceneRoom?.name ?? "Whole home")}
          </Txt>
        </View>
      </Pressable>
      <View style={styles.sceneTools}>
        {(scene.source === "home-assistant" || scene.haSceneId) && (
          <Txt
            size={10}
            weight="medium"
            tone="okInk"
            style={[
              styles.badge,
              { borderColor: colors.okBorder, backgroundColor: colors.okBg },
            ]}
            numberOfLines={1}
          >
            Home Assistant
          </Txt>
        )}
        <View style={{ flex: 1 }} />
        {scene.source === "glow" && (
          <IconButton
            icon={Pencil}
            size={16}
            label={`Edit ${scene.name}`}
            onPress={() => onEdit(scene)}
            style={styles.smallIcon}
          />
        )}
        <IconButton
          icon={Heart}
          size={16}
          filled={scene.favorite}
          color={scene.favorite ? colors.accent : undefined}
          label={`${scene.favorite ? "Unfavorite" : "Favorite"} ${scene.name}`}
          accessibilityState={{ selected: scene.favorite }}
          onPress={() => onFavorite(scene)}
          style={styles.smallIcon}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  roomCard: { padding: 18, gap: 12 },
  lightCard: { padding: 16, gap: 10 },
  heading: { flexDirection: "row", alignItems: "center", gap: 14 },
  roomName: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  cardLinks: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  link: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  sceneCard: { flex: 1, padding: 14, gap: 10, minHeight: 168 },
  sceneActivate: { flex: 1, gap: 12 },
  activeMark: {
    position: "absolute",
    left: 42,
    top: 40,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sceneTools: { flexDirection: "row", alignItems: "center", gap: 2 },
  smallIcon: { width: 34, height: 34 },
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
    flexShrink: 1,
  },
});
