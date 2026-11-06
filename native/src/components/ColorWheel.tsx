import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
} from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { colorName, colorsClose, hexToHsv, hsvToHex } from "../core";
import { useColors } from "../theme";
import { useHold } from "./hold";

type Point = { h: number; s: number };
const center: Point = { h: 0, s: 0 };
const wheel = require("../../assets/color-wheel.png");

// A hue and saturation wheel: hue runs clockwise from red at the top, and
// saturation grows from the white center to the rim. Brightness has its own
// slider. The thumb follows the finger, while changes are sent at most once
// per frame; the live layer then paces them for the bulb.
export function ColorWheel({
  color,
  label,
  white = false,
  disabled = false,
  compact = false,
  onChange,
}: {
  color: string;
  label: string;
  // The light shows a white temperature, so no color is selected.
  white?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onChange: (color: string) => void;
}) {
  const colors = useColors();
  const size = compact ? 168 : 216;
  const [drag, setDrag] = useState<Point | null>(null);
  // Bulbs report back a slightly different, rounded color. Keep the thumb
  // where the person left it while the reported color still matches.
  const [held, setHeld] = useState<Point | null>(null);
  const reported = useMemo(() => hexToHsv(color), [color]);
  const point =
    drag ??
    (white
      ? center
      : held && colorsClose(hsvToHex(held.h, held.s), color)
        ? held
        : reported);

  const send = useRef(onChange);
  send.current = onChange;
  const frame = useRef(0);
  const queued = useRef<string | null>(null);
  const flush = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (queued.current) send.current(queued.current);
    queued.current = null;
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const dragging = useRef<Point | null>(null);
  const move = (event: { x: number; y: number }) => {
    const radius = size / 2;
    const x = event.x - radius;
    const y = event.y - radius;
    const next = {
      h: ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360,
      s: Math.min(1, Math.hypot(x, y) / radius),
    };
    dragging.current = next;
    setDrag(next);
    queued.current = hsvToHex(next.h, next.s);
    frame.current ||= requestAnimationFrame(flush);
  };
  const release = () => {
    if (dragging.current) setHeld(dragging.current);
    dragging.current = null;
    setDrag(null);
    flush();
  };
  // The page or sheet holds still while a finger is on the wheel, whichever
  // way it moves.
  const hold = useHold();
  const pan = usePanGesture({
    minDistance: 0,
    enabled: !disabled,
    runOnJS: true,
    disableReanimated: true,
    onBegin: (event) => {
      hold(true);
      move(event);
    },
    onUpdate: move,
    onFinalize: () => {
      hold(false);
      release();
    },
  });
  const adjust = (event: AccessibilityActionEvent) => {
    const step = 15;
    const next =
      event.nativeEvent.actionName === "increment"
        ? { h: (point.h + step) % 360, s: point.s || 1 }
        : { h: (point.h - step + 360) % 360, s: point.s || 1 };
    setHeld(next);
    send.current(hsvToHex(next.h, next.s));
  };

  const angle = (point.h * Math.PI) / 180;
  const shown = hsvToHex(point.h, point.s);
  const thumb = drag ? 34 : 30;
  return (
    <View
      style={[
        styles.ring,
        {
          width: size + 10,
          height: size + 10,
          borderRadius: (size + 10) / 2,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          accessibilityValue={{
            min: 0,
            max: 359,
            now: Math.round(point.h) % 360,
            text:
              white && !drag
                ? "White light"
                : `${colorName(shown)}, hue ${Math.round(point.h) % 360}°, saturation ${Math.round(point.s * 100)}%`,
          }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={disabled ? undefined : adjust}
          style={{ width: size, height: size }}
        >
          <View pointerEvents="none">
            <Image source={wheel} style={{ width: size, height: size }} />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                width: thumb,
                height: thumb,
                borderRadius: thumb / 2,
                left:
                  size / 2 + Math.sin(angle) * point.s * (size / 2) - thumb / 2,
                top:
                  size / 2 - Math.cos(angle) * point.s * (size / 2) - thumb / 2,
                backgroundColor: white && !drag ? "#fffefa" : shown,
              },
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    alignSelf: "center",
  },
  thumb: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "#fffefa",
    shadowColor: "#3a3526",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
