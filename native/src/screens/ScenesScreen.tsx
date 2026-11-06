import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Heart, Sparkles } from "lucide-react-native";
import { useGlow } from "../glow";
import { Page } from "../components/Overlays";
import { Chip, Title } from "../components/ui";
import { Loading } from "./RoomsScreen";
import { EmptyState, SceneGrid } from "./shared";

// "all", "favorites", or a room id.
type SceneFilter = string;

export function ScenesScreen() {
  const { home } = useGlow();
  const [filter, setFilter] = useState<SceneFilter>("all");
  if (!home) return <Loading />;
  const scenes = home.scenes.filter(
    (s) =>
      filter === "all" ||
      (filter === "favorites" ? s.favorite : s.roomId === filter),
  );
  return (
    <Page>
      <Title>Scenes</Title>
      <View accessibilityLabel="Filter scenes" style={styles.filters}>
        <Chip
          label="All scenes"
          selected={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <Chip
          label="Favorites"
          icon={Heart}
          selected={filter === "favorites"}
          onPress={() => setFilter("favorites")}
        />
      </View>
      <ScrollView
        horizontal
        accessibilityLabel="Scenes in room"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rooms}
        style={styles.roomScroller}
      >
        {home.rooms.map((room) => (
          <Chip
            key={room.id}
            label={room.name}
            selected={filter === room.id}
            onPress={() => setFilter(filter === room.id ? "all" : room.id)}
          />
        ))}
      </ScrollView>
      <SceneGrid scenes={scenes} inRoom={false} />
      {!scenes.length && (
        <EmptyState
          icon={Sparkles}
          title="No scenes yet"
          text={
            filter === "favorites"
              ? "Tap the heart on any scene to make it a favorite."
              : "Open a room to save your first scene."
          }
          action={filter === "favorites" ? "Explore scenes" : "Go to rooms"}
          onAction={() =>
            filter === "favorites" ? setFilter("all") : router.navigate("/")
          }
        />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8 },
  roomScroller: { marginHorizontal: -18, marginTop: -8 },
  rooms: { gap: 8, paddingHorizontal: 18 },
});
