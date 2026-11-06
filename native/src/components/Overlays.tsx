import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "expo-router/tabs";
import { Check, CircleHelp, RotateCcw, WifiOff, X } from "lucide-react-native";
import { useGlow } from "../glow";
import { useColors } from "../theme";
import { LightEditor } from "./LightEditor";
import { LightGroupSettings } from "./LightGroupSettings";
import { SceneEditor } from "./SceneEditor";
import { Notice, Txt } from "./ui";

// The dialogs and notifications that sit above every tab.
export function Overlays() {
  const glow = useGlow();
  const { home, toast } = glow;
  const errorMessage = toast?.error ? toast.message : undefined;
  const currentLight =
    home?.lights.find((l) => l.id === glow.lightEditor) ??
    home?.groups?.find((group) => group.id === glow.lightEditor);
  return (
    <>
      {home && glow.customizeRoom && (
        <LightGroupSettings
          groups={
            home.groups?.filter(
              (group) => group.roomId === glow.customizeRoom,
            ) ?? []
          }
          lights={home.lights}
          roomName={
            home.rooms.find((item) => item.id === glow.customizeRoom)?.name ??
            ""
          }
          busy={glow.busy}
          onClose={glow.closeCustomizeRoom}
          onChange={(groupId, display) =>
            glow.action("group-display", { groupId, display }, "PUT")
          }
        />
      )}
      {home &&
        glow.sceneEditor &&
        home.rooms.some((r) => r.id === glow.sceneEditor!.roomId) && (
          <SceneEditor
            home={home}
            roomId={glow.sceneEditor.roomId}
            scene={glow.sceneEditor.scene}
            busy={glow.busy}
            errorMessage={errorMessage}
            onClose={glow.closeSceneEditor}
            onPreview={glow.previewLights}
            onSave={(body, id) =>
              glow.action(
                id ? `scenes/${encodeURIComponent(id)}` : "scenes",
                body,
                id ? "PUT" : "POST",
                id ? "Scene updated" : "Scene saved",
              )
            }
            onDelete={(id) =>
              glow.action(
                `scenes/${encodeURIComponent(id)}`,
                {},
                "DELETE",
                "Scene deleted",
              )
            }
          />
        )}
      {currentLight && (
        <LightEditor
          light={currentLight}
          roomName={home?.rooms.find((r) => r.id === currentLight.roomId)?.name}
          disabled={glow.disabled}
          error={errorMessage}
          onChange={glow.lightsAction}
          onClose={glow.closeLightEditor}
        />
      )}
    </>
  );
}

// Toasts appear above the tab bar, and inside open dialogs as notices.
export function ToastView() {
  const colors = useColors();
  const { toast, setToast, busy } = useGlow();
  // Rendered beside the tabs rather than in one, so estimate the tab bar.
  const tabBar = useSafeAreaInsets().bottom + 64;
  if (!toast && !busy) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { justifyContent: "flex-end" }]}
    >
      {busy && !toast && (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Saving changes"
          style={[
            styles.toast,
            {
              bottom: tabBar + 12,
              alignSelf: "center",
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
            },
          ]}
        >
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}
      {toast && (
        <View
          accessibilityRole={toast.error ? "alert" : "summary"}
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            {
              bottom: tabBar + 12,
              left: 16,
              right: 16,
              backgroundColor: toast.error ? colors.dangerBg : colors.text,
              borderColor: toast.error ? colors.dangerBorder : colors.text,
            },
          ]}
        >
          {toast.error ? (
            <CircleHelp size={18} color={colors.dangerInk} />
          ) : (
            <Check size={18} color={colors.bg} />
          )}
          <Txt
            size={14}
            weight="medium"
            color={toast.error ? colors.dangerInk : colors.bg}
            style={{ flex: 1 }}
          >
            {toast.message}
          </Txt>
          {toast.action && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toast.action.label}
              onPress={toast.action.run}
              hitSlop={8}
              style={[styles.toastAction, { borderColor: colors.bg }]}
            >
              <RotateCcw size={14} color={colors.bg} />
              <Txt size={13} weight="semibold" color={colors.bg}>
                {toast.action.label}
              </Txt>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
            onPress={() => setToast(null)}
            hitSlop={10}
          >
            <X size={18} color={toast.error ? colors.dangerInk : colors.bg} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// A scrolling page under the tab bar, with the reconnection banner.
export function Page({
  children,
  onRefresh,
}: {
  children: ReactNode;
  onRefresh?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBar = useBottomTabBarHeight();
  const { home } = useGlow();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: tabBar + 90,
        paddingHorizontal: 18,
        gap: 18,
        width: "100%",
        maxWidth: 900,
        alignSelf: "center",
      }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={false}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        ) : undefined
      }
    >
      {home && !home.connected && (
        <Notice kind="warn" icon={WifiOff}>
          <Txt size={14} weight="semibold" tone="warnInkStrong">
            Reconnecting to your home
          </Txt>
          <Txt size={13} tone="warnInk" style={{ marginTop: 2 }}>
            {home.error ||
              "Controls will be available as soon as the connection is restored."}
          </Txt>
        </Notice>
      )}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    maxWidth: 640,
  },
  toastAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
