import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  colorName,
  colorsClose,
  hexToHsv,
  hsvToHex,
} from "../packages/core/color.mjs";

type Point = { h: number; s: number };
const center: Point = { h: 0, s: 0 };

// A hue and saturation wheel: hue runs clockwise from red at the top, and
// saturation grows from the white center to the rim. Brightness has its own
// slider. The thumb follows the finger at screen rate, while changes are sent
// at most once per frame; the live layer then paces them for the bulb.
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

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const radius = bounds.width / 2;
    const x = event.clientX - bounds.left - radius;
    const y = event.clientY - bounds.top - radius;
    const next = {
      h: ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360,
      s: Math.min(1, Math.hypot(x, y) / radius),
    };
    setDrag(next);
    queued.current = hsvToHex(next.h, next.s);
    frame.current ||= requestAnimationFrame(flush);
  };
  const release = () => {
    if (drag) setHeld(drag);
    setDrag(null);
    flush();
  };
  const keyboard = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 15 : 5;
    const moves: Record<string, Point> = {
      ArrowRight: { h: (point.h + step) % 360, s: point.s || 1 },
      ArrowLeft: { h: (point.h - step + 360) % 360, s: point.s || 1 },
      ArrowUp: { h: point.h, s: Math.min(1, point.s + step / 100) },
      ArrowDown: { h: point.h, s: Math.max(0, point.s - step / 100) },
    };
    const next = moves[event.key];
    if (!next || disabled) return;
    event.preventDefault();
    setHeld(next);
    send.current(hsvToHex(next.h, next.s));
  };

  const angle = (point.h * Math.PI) / 180;
  const shown = hsvToHex(point.h, point.s);
  return (
    <div
      className={`color-wheel ${compact ? "compact" : ""} ${drag ? "dragging" : ""} ${disabled ? "disabled" : ""}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={Math.round(point.h) % 360}
      aria-valuetext={
        white && !drag
          ? "White light"
          : `${colorName(shown)}, hue ${Math.round(point.h) % 360}°, saturation ${Math.round(point.s * 100)}%`
      }
      onKeyDown={keyboard}
      onPointerDown={(event) => {
        if (disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={(event) => {
        if (drag) move(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => drag && release()}
    >
      <span
        className={`color-wheel-thumb ${white && !drag ? "white" : ""}`}
        style={
          {
            left: `${50 + Math.sin(angle) * point.s * 50}%`,
            top: `${50 - Math.cos(angle) * point.s * 50}%`,
            "--thumb": shown,
          } as CSSProperties
        }
      />
    </div>
  );
}
