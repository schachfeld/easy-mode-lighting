import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import type { GroupDisplay, Light, LightGroup } from "../core";
import { useColors } from "../theme";
import { Sheet } from "./Sheet";
import { Button, Notice, Txt } from "./ui";

// A list of radio options, used for group display and the theme.
export function Choices<T extends string>({
  value,
  options,
  disabled = false,
  onChange,
}: {
  value: T;
  options: { id: T; title: string; description: string; preview?: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityLabel={option.title}
            accessibilityHint={option.description}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.id)}
            style={[
              styles.choice,
              {
                backgroundColor: selected ? colors.selected : colors.surface,
                borderColor: selected ? colors.borderSelected : colors.border,
                opacity: disabled ? 0.6 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.radio,
                {
                  borderColor: selected ? colors.accent : colors.borderStrong,
                },
              ]}
            >
              {selected && (
                <View
                  style={[styles.radioDot, { backgroundColor: colors.accent }]}
                />
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={15} weight="semibold">
                {option.title}
              </Txt>
              <Txt size={12} tone="muted">
                {option.description}
              </Txt>
            </View>
            {option.preview && (
              <View
                style={[
                  styles.preview,
                  {
                    backgroundColor: option.preview,
                    borderColor: colors.borderStrong,
                  },
                ]}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export function LightGroupSettings({
  groups,
  lights,
  roomName,
  onClose,
  onChange,
  busy,
}: {
  groups: LightGroup[];
  lights: Light[];
  roomName: string;
  onClose: () => void;
  onChange: (groupId: string, display: GroupDisplay) => Promise<boolean>;
  busy: boolean;
}) {
  const [error, setError] = useState("");
  return (
    <Sheet
      title="Customize lights"
      subtitle={roomName}
      onClose={onClose}
      footer={
        <Button
          kind="primary"
          label="Done"
          iconRight={Check}
          disabled={busy}
          onPress={onClose}
        />
      }
    >
      <Txt size={14} tone="textSecondary" style={{ lineHeight: 20 }}>
        Choose how each group appears. Room controls and scenes still include
        the individual lights.
      </Txt>
      {groups.map((group) => (
        <View key={group.id} style={{ gap: 8, marginTop: 4 }}>
          <Txt size={16} weight="semibold">
            {group.name}
          </Txt>
          <Txt size={12} tone="muted">
            {group.memberIds
              .map((id) => lights.find((light) => light.id === id)?.name)
              .join(" · ")}
          </Txt>
          <Choices<GroupDisplay>
            value={group.display}
            disabled={busy}
            options={[
              {
                id: "group",
                title: "Show as a group",
                description: "One control, with individual lights inside.",
              },
              {
                id: "individual",
                title: "Show individual lights",
                description: "Separate controls, without the group card.",
              },
            ]}
            onChange={async (display) => {
              setError("");
              if (!(await onChange(group.id, display)))
                setError(
                  "Could not save your display preference. Please try again.",
                );
            }}
          />
        </View>
      ))}
      <Txt size={12} tone="muted">
        Saved on this device for this home.
      </Txt>
      {error ? <Notice kind="error">{error}</Notice> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  preview: { width: 34, height: 34, borderRadius: 10, borderWidth: 1 },
});
