import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  ChevronRight,
  House,
  Lightbulb,
  Moon,
  Power,
} from "lucide-react-native";
import { plural } from "../core";
import { useGlow } from "../glow";
import { useColors } from "../theme";
import { RoomCard } from "../components/cards";
import { Page } from "../components/Overlays";
import { Button, Card, Chip, Title, Txt } from "../components/ui";
import { EmptyState } from "./shared";

const icon = require("../../assets/icon.png");

export function ConnectionStatus() {
  const colors = useColors();
  const { home, mode } = useGlow();
  const online = Boolean(home?.connected);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings & help"
      onPress={() => router.navigate("/settings")}
      style={[
        styles.pill,
        {
          backgroundColor: online ? colors.okBg : colors.warnBg,
          borderColor: online ? colors.okBorder : colors.warnBorder,
        },
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: online ? colors.statusOn : colors.warnDot },
        ]}
      />
      <Txt
        size={12}
        weight="medium"
        color={online ? colors.okInk : colors.warnInk}
      >
        {mode === "demo" ? "Demo home" : online ? "Connected" : "Connecting…"}
      </Txt>
      <ChevronRight size={12} color={online ? colors.okInk : colors.warnInk} />
    </Pressable>
  );
}

export function RoomsScreen() {
  const colors = useColors();
  const glow = useGlow();
  const [filter, setFilter] = useState<"all" | "on">("all");
  const home = glow.home;
  if (!home) return <Loading />;
  const lit = home.lights.filter((l) => l.on && l.available);
  const litRooms = new Set(lit.map((l) => l.roomId));
  const rooms = home.rooms.filter(
    (r) => filter === "all" || litRooms.has(r.id),
  );
  return (
    <Page>
      <View style={styles.brandRow}>
        <View style={styles.brand}>
          <Image source={icon} style={styles.brandMark} />
          <Txt size={24} weight="bold" style={{ letterSpacing: -1.2 }}>
            glow
            <Txt size={24} weight="bold" tone="accent">
              .
            </Txt>
          </Txt>
        </View>
        <ConnectionStatus />
      </View>
      <Title>Rooms</Title>
      <Card style={styles.summary}>
        <View
          style={[
            styles.summaryBulb,
            { backgroundColor: colors.surfaceSunken },
          ]}
        >
          <Lightbulb size={23} color={colors.glowInk} strokeWidth={1.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt size={16} weight="semibold">
            {plural(lit.length, "light")} on
          </Txt>
          <Txt size={12} tone="muted">
            across{" "}
            {plural(
              home.rooms.filter((r) => litRooms.has(r.id)).length,
              "room",
            )}
          </Txt>
        </View>
        <Button
          icon={Power}
          label="All lights off"
          disabled={glow.disabled || !lit.length}
          onPress={glow.allLightsOff}
        />
      </Card>
      <View accessibilityLabel="Filter rooms" style={styles.filters}>
        <Chip
          label="All rooms"
          selected={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <Chip
          label="Lights on"
          selected={filter === "on"}
          onPress={() => setFilter("on")}
        />
      </View>
      <View style={styles.grid}>
        {rooms.map((room) => (
          <View key={room.id} style={styles.cell}>
            <RoomCard
              room={room}
              lights={home.lights.filter((l) => l.roomId === room.id)}
              scenes={home.scenes}
              disabled={glow.disabled}
              onOpen={(id) =>
                router.push({ pathname: "/room/[id]", params: { id } })
              }
              onLightsChange={glow.lightsAction}
            />
          </View>
        ))}
      </View>
      {!home.rooms.length ? (
        <EmptyState
          icon={House}
          title="No rooms yet"
          text="Add lights to Areas in Home Assistant and they’ll appear here automatically. Unassigned lights appear in “Other lights”."
          action="How it works"
          onAction={() => router.navigate("/settings")}
        />
      ) : (
        filter === "on" &&
        !lit.length && (
          <EmptyState
            icon={Moon}
            title="All lights are off"
            text="Choose a room to turn on its lights."
            action="Show all rooms"
            onAction={() => setFilter("all")}
          />
        )
      )}
    </Page>
  );
}

export function Loading() {
  const colors = useColors();
  return (
    <View style={[styles.loading, { backgroundColor: colors.bg }]}>
      <Lightbulb size={42} color={colors.glowInk} strokeWidth={1.4} />
      <Txt size={20} weight="semibold">
        Loading lights
      </Txt>
      <Txt tone="muted">Connecting to your home…</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandMark: { width: 30, height: 30, borderRadius: 9 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    flexWrap: "wrap",
  },
  summaryBulb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: { flexDirection: "row", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { flexGrow: 1, flexBasis: 300 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
});
