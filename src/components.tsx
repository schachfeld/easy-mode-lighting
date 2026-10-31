import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Armchair,
  Bath,
  BedDouble,
  CookingPot,
  Flower2,
  House,
  Monitor,
  Sun,
  Utensils,
  X,
} from "lucide-react";
import { whiteToHex } from "../packages/core/color.mjs";

export const roomIcons: Record<string, typeof Armchair> = {
  living: Armchair,
  bedroom: BedDouble,
  kitchen: CookingPot,
  office: Monitor,
  bathroom: Bath,
  dining: Utensils,
  garden: Flower2,
  home: House,
};
export function RoomIcon({
  style,
  size = 22,
}: {
  style: string;
  size?: number;
}) {
  const Icon = roomIcons[style] ?? Armchair;
  return <Icon size={size} strokeWidth={1.7} />;
}

export function Toggle({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${on ? "is-on" : ""}`}
      onClick={onChange}
    >
      <span />
    </button>
  );
}

// A thick, touch-friendly range control. The track and fill are painted by a
// wrapper, so the fill always ends under the knob in every browser engine.
// Lights follow the slider while it moves: the caller coalesces commands, and
// releasing it reports whether the final value was accepted.
export function LiveSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  label,
  compact = false,
  paint,
  spectrum = false,
  icon,
  format,
  valueText,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void | Promise<boolean | void>;
  disabled?: boolean;
  label: string;
  compact?: boolean;
  // A CSS gradient for the fill, or for the whole track with `spectrum`.
  paint?: string;
  spectrum?: boolean;
  icon?: ReactNode;
  format: (value: number) => ReactNode;
  valueText?: (value: number) => string;
}) {
  const [draft, setDraft] = useState(value);
  const changing = useRef(false);
  const latest = useRef(value);
  const sent = useRef<Promise<boolean | void>>(Promise.resolve());
  latest.current = value;
  useEffect(() => {
    if (!changing.current) setDraft(value);
  }, [value]);
  const commit = async () => {
    if (changing.current) {
      changing.current = false;
      const accepted = await sent.current;
      if (accepted === false && !changing.current) setDraft(latest.current);
    }
  };
  const position = max > min ? (draft - min) / (max - min) : 0;
  return (
    <div
      className={`slider ${compact ? "compact" : ""} ${spectrum ? "spectrum" : ""} ${disabled ? "disabled" : ""}`}
    >
      {icon}
      <div
        className="slider-track"
        style={
          {
            "--p": Math.max(0, Math.min(1, position)),
            ...(paint ? { "--paint": paint } : {}),
          } as CSSProperties
        }
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={draft}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={valueText?.(draft)}
          onChange={(e) => {
            const next = Number(e.target.value);
            changing.current = true;
            setDraft(next);
            sent.current = Promise.resolve(onChange(next));
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          onPointerCancel={commit}
        />
      </div>
      <span className="slider-value" aria-hidden="true">
        {format(draft)}
      </span>
    </div>
  );
}

export function Brightness({
  value,
  onChange,
  disabled = false,
  label = "Brightness",
  compact = false,
  paint,
}: {
  value: number;
  onChange: (value: number) => void | Promise<boolean | void>;
  disabled?: boolean;
  label?: string;
  compact?: boolean;
  paint?: string;
}) {
  return (
    <LiveSlider
      value={value}
      min={value === 0 ? 0 : 1}
      max={100}
      onChange={onChange}
      disabled={disabled}
      label={label}
      compact={compact}
      paint={paint}
      icon={<Sun size={compact ? 17 : 20} strokeWidth={1.8} aria-hidden />}
      format={(v) => (
        <>
          {v}
          <small>%</small>
        </>
      )}
      valueText={(v) => `${v}%`}
    />
  );
}

export function kelvinGradient(min: number, max: number) {
  const stops = Array.from({ length: 6 }, (_, i) =>
    whiteToHex(min + ((max - min) * i) / 5),
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.documentElement.classList.add("modal-open");
    return () => {
      dialog.close();
      document.documentElement.classList.remove("modal-open");
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const bounds = ref.current.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
      aria-labelledby={titleId}
    >
      <div className="modal-grabber" aria-hidden="true" />
      <div className="modal-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-button close-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

// Up to three colors, blended into a soft sphere.
export function SceneOrb({
  colors,
  size = "large",
}: {
  colors: string[];
  size?: "large" | "medium" | "small";
}) {
  const [c1, c2 = c1, c3 = c2] = colors;
  return (
    <div
      className={`scene-orb ${size}`}
      style={{ "--c1": c1, "--c2": c2, "--c3": c3 } as CSSProperties}
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </div>
  );
}
