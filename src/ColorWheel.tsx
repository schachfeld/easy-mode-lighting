import {
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { colorName, hexToHsv, hsvToHex } from "../packages/core/color.mjs";

type Point = { h: number; s: number };

// Hue runs clockwise from red at the top; saturation grows from the white
// center to the rim. Brightness has its own slider, so value is always full.
export function ColorWheel({
  color,
  disabled = false,
  label,
  onChange,
}: {
  color: string;
  disabled?: boolean;
  label: string;
  onChange: (color: string) => void;
}) {
  // Follow the light, except mid-drag, where the pointer is the truth. Deriving
  // it during render means the keyboard never starts from a stale color.
  const current = useMemo(() => hexToHsv(color), [color]);
  const [drag, setDrag] = useState<Point | null>(null);
  const point = drag ?? current;

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const radius = bounds.width / 2;
    const x = event.clientX - bounds.left - radius;
    const y = event.clientY - bounds.top - radius;
    const next = {
      h: ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360,
      s: Math.min(1, Math.hypot(x, y) / radius),
    };
    setDrag(next);
    onChange(hsvToHex(next.h, next.s));
  };
  const keyboard = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 15 : 5;
    const moves: Record<string, Point> = {
      ArrowRight: { h: (point.h + step + 360) % 360, s: point.s },
      ArrowLeft: { h: (point.h - step + 360) % 360, s: point.s },
      ArrowUp: { h: point.h, s: Math.min(1, point.s + step / 100) },
      ArrowDown: { h: point.h, s: Math.max(0, point.s - step / 100) },
    };
    const next = moves[event.key];
    if (!next || disabled) return;
    event.preventDefault();
    onChange(hsvToHex(next.h, next.s));
  };
  const angle = (point.h * Math.PI) / 180;
  const shown = hsvToHex(point.h, point.s);
  return (
    <div
      className={`color-wheel ${disabled ? "disabled" : ""}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={Math.round(point.h) % 360}
      aria-valuetext={`${colorName(shown)}, hue ${Math.round(point.h) % 360}°, saturation ${Math.round(point.s * 100)}%`}
      onKeyDown={keyboard}
      onPointerDown={(event) => {
        if (disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        fromPointer(event);
      }}
      onPointerMove={(event) => {
        if (drag) fromPointer(event);
      }}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      <span
        className="color-wheel-thumb"
        style={
          {
            "--x": `${50 + Math.sin(angle) * point.s * 50}%`,
            "--y": `${50 - Math.cos(angle) * point.s * 50}%`,
            background: shown,
          } as CSSProperties
        }
      />
    </div>
  );
}
