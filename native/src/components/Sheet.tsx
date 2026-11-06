import { useState, type ReactNode } from "react";
// Gesture Handler's scroll view gives way to a slider or the color wheel that
// holds the touch.
import {
  GestureHandlerRootView,
  ScrollView,
} from "react-native-gesture-handler";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useColors } from "../theme";
import { HoldContext } from "./hold";
import { IconButton, Txt } from "./ui";

// A bottom sheet for dialogs. The back gesture, the backdrop and the close
// button all call onClose, which may keep the sheet open, for example to
// confirm discarding changes.
export function Sheet({
  title,
  subtitle,
  children,
  footer,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [held, setHeld] = useState(false);
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* Android shows modals in their own window, which needs its own root. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.backdrop, { backgroundColor: colors.backdrop }]}
        >
          <Pressable
            style={{ flex: 1, minHeight: insets.top + 24 }}
            accessibilityLabel="Close dialog"
            accessibilityRole="button"
            onPress={onClose}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: colors.bg,
                borderColor: colors.border,
                maxHeight: "94%",
              },
            ]}
          >
            <View
              style={[styles.grabber, { backgroundColor: colors.borderStrong }]}
            />
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Txt
                  accessibilityRole="header"
                  size={22}
                  weight="semibold"
                  style={{ letterSpacing: -0.4 }}
                >
                  {title}
                </Txt>
                {subtitle ? (
                  <Txt size={13} tone="muted" style={{ marginTop: 3 }}>
                    {subtitle}
                  </Txt>
                ) : null}
              </View>
              <IconButton icon={X} label="Close dialog" onPress={onClose} />
            </View>
            <ScrollView
              scrollEnabled={!held}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              <HoldContext.Provider value={setHeld}>
                {children}
              </HoldContext.Provider>
            </ScrollView>
            {footer && (
              <View
                style={[
                  styles.footer,
                  {
                    borderColor: colors.border,
                    paddingBottom: Math.max(insets.bottom, 12) + 4,
                  },
                ]}
              >
                {footer}
              </View>
            )}
            {!footer && <View style={{ height: insets.bottom }} />}
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
