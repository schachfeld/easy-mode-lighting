import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import type { Scene } from "../core";
import { useGlow } from "../glow";
import { useColors } from "../theme";
import { SceneCard } from "../components/cards";
import { Button, Txt } from "../components/ui";

export function SceneGrid({
  scenes,
  inRoom,
}: {
  scenes: Scene[];
  inRoom: boolean;
}) {
  const glow = useGlow();
  const home = glow.home!;
  return (
    <View style={styles.grid}>
      {scenes.map((scene) => (
        <View key={scene.id} style={styles.cell}>
          <SceneCard
            scene={scene}
            home={home}
            inRoom={inRoom}
            disabled={glow.disabled}
            onActivate={glow.activateScene}
            onFavorite={glow.favoriteScene}
            onEdit={(scene) => glow.openSceneEditor(scene.roomId!, scene)}
          />
        </View>
      ))}
    </View>
  );
}

export function SectionHeading({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.heading}>
      <View style={styles.headingTitle}>
        <Txt accessibilityRole="header" size={20} weight="semibold">
          {title}
        </Txt>
        {count !== undefined && (
          <Txt
            size={12}
            weight="medium"
            tone="muted"
            style={[styles.count, { backgroundColor: colors.surfaceSunken }]}
          >
            {count}
          </Txt>
        )}
      </View>
      {children}
    </View>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.empty,
        { borderColor: colors.borderStrong, backgroundColor: colors.surface },
      ]}
    >
      <Icon size={32} color={colors.faint} strokeWidth={1.5} />
      <Txt size={17} weight="semibold">
        {title}
      </Txt>
      <Txt
        size={14}
        tone="muted"
        style={{ textAlign: "center", lineHeight: 20 }}
      >
        {text}
      </Txt>
      <Button label={action} onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "48.5%", flexGrow: 1, maxWidth: 280 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  headingTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  count: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  empty: {
    alignItems: "center",
    gap: 10,
    padding: 28,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
  },
});
