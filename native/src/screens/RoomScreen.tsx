import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Plus, Settings2 } from "lucide-react-native";
import {
  averageBrightness,
  lightTargets,
  plural,
  roomLightLayout,
} from "../core";
import { useGlow } from "../glow";
import { roomTone, useColors } from "../theme";
import { RoomIcon } from "../components/art";
import { LightCard } from "../components/cards";
import { Page } from "../components/Overlays";
import { Brightness } from "../components/Slider";
import {
  Button,
  Card,
  FieldLabel,
  Notice,
  Toggle,
  ToggleColor,
  Txt,
} from "../components/ui";
import { Loading } from "./RoomsScreen";
import { SceneGrid, SectionHeading } from "./shared";

export function RoomScreen({ roomId }: { roomId: string }) {
  const colors = useColors();
  const glow = useGlow();
  const home = glow.home;
  if (!home) return <Loading />;
  const room = home.rooms.find((r) => r.id === roomId);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  if (!room)
    return (
      <Page>
        <Button
          kind="plain"
          icon={ArrowLeft}
          label="All rooms"
          onPress={back}
          style={styles.back}
        />
        <Notice>This room is no longer in your home.</Notice>
      </Page>
    );
  const tone = roomTone(colors, room.style);
  const lights = home.lights.filter((l) => l.roomId === room.id);
  const onCount = lights.filter((l) => l.on && l.available).length;
  const anyAvailable = lights.some((l) => l.available);
  const hasGroups = home.groups?.some((group) => group.roomId === room.id);
  const layout = roomLightLayout(home, room.id);
  const scenes = home.scenes.filter((s) => s.roomId === room.id);
  return (
    <ToggleColor.Provider value={tone.on}>
      <Page>
        <Button
          kind="plain"
          icon={ArrowLeft}
          label="All rooms"
          onPress={back}
          style={styles.back}
        />
        <Card
          style={[
            styles.hero,
            { backgroundColor: tone.bg, borderColor: tone.bg },
          ]}
        >
          <RoomIcon style={room.style} size={52} />
          <View style={{ flex: 1 }}>
            <Txt
              accessibilityRole="header"
              size={28}
              weight="semibold"
              style={{ letterSpacing: -0.8 }}
            >
              {room.name}
            </Txt>
            <Txt size={13} color={tone.ink}>
              {onCount} of {plural(lights.length, "light")} on
            </Txt>
          </View>
          <Toggle
            label={`${room.name} all lights`}
            on={onCount > 0}
            disabled={glow.disabled || !anyAvailable}
            onChange={() => glow.lightsAction(lights, { on: !onCount })}
          />
        </Card>
        {lights.some((l) => l.dimmable) && (
          <Card style={styles.master}>
            <FieldLabel>Room brightness</FieldLabel>
            <Brightness
              value={averageBrightness(lights)}
              label="Room brightness"
              disabled={glow.disabled || !anyAvailable}
              onChange={(brightness) =>
                glow.lightsAction(lights, { on: true, brightness })
              }
            />
          </Card>
        )}
        <SectionHeading title="Scenes" count={scenes.length}>
          <Button
            kind="primary"
            icon={Plus}
            label="Create scene"
            onPress={() => glow.openSceneEditor(room.id)}
          />
        </SectionHeading>
        <SceneGrid scenes={scenes} inRoom />
        <SectionHeading title="Lights" count={lights.length}>
          {hasGroups && (
            <Button
              kind="text"
              icon={Settings2}
              label="Customize lights"
              onPress={() => glow.openCustomizeRoom(room.id)}
            />
          )}
        </SectionHeading>
        {layout.overlapping.length > 0 && (
          <Notice>
            Some groups share lights. Their lamps are shown individually so each
            appears once.
          </Notice>
        )}
        <View style={{ gap: 12 }}>
          {layout.items.map((light) => (
            <LightCard
              key={light.id}
              light={light}
              members={
                "memberIds" in light
                  ? lightTargets(home, light.memberIds)
                  : undefined
              }
              disabled={glow.disabled}
              onChange={glow.lightsAction}
              onAdjust={glow.openLightEditor}
            />
          ))}
        </View>
      </Page>
    </ToggleColor.Provider>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", marginBottom: -8 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 20,
    borderRadius: 20,
  },
  master: { padding: 16, gap: 4 },
});
