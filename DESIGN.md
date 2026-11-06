# Glow design direction

This is the design brief for both current apps: the React Native phone app in `native/` and the Home Assistant add-on UI in `src/`. They share one look. A change to a color, a type size or a control in one app should land in the other too.

Dial: ENERGY 1 / RHYTHM 1 / MOTION 1

Glow is a light switch you keep open every evening. It should feel calm and warm, and get out of the way. The screens repeat one card pattern on purpose, because people scan rooms and lights rather than read them. Motion is limited to state changes: switches, sheets and toasts.

## Identity

- **Firefly jar.** The app icon is a jar of fireflies glowing terracotta and amber against a dark green wall. Firefly, the default theme, is that night palette: warm cream text on dark moss, with a terracotta accent. Daylight is the same palette in daylight: warm off-white paper, olive greys and the same terracotta.
- **Wordmark.** `glow.` in DM Sans Bold, lower case with tight tracking. The period is the one place the accent appears purely as brand.
- **Scene orbs.** A scene is a palette of light, drawn as three soft blobs inside a circle. The orb is Glow's own mark for a scene, and the Scenes tab uses a palette icon because of it.
- **Room tones.** Each room style (living, bedroom, kitchen and so on) has its own quiet tile color and switch color, so a room is recognizable before its name is read.

## Color

- Colors are tokens in `native/src/theme.tsx` and at the top of `src/styles.css`. Keep the two in step.
- The accent `#df7855` (terracotta) marks the primary action, switches that are on and selection. It doesn't go on decoration.
- Colors that show a light's real color (orbs, swatches, the color wheel, bulb icons) stay the same in every theme.
- **Contrast floor, in both themes:** every text token (`text`, `textSecondary`, `muted`, `faint`, `leaf`, the status inks, `accentDark`) is at least 4.5:1 on `bg`, `surface`, `surfaceSunken` and `hover`. Control colors (switch borders, switches that are on, slider fill, room switch colors, the focus ring) are at least 3:1 on `surface`. Check a new or changed token before shipping it.
- Text on the accent uses the dark `onAccent` ink in both themes. White text on terracotta doesn't reach 4.5:1.

## Type

- **DM Sans** (400, 500, 600, 700). It has round, friendly letterforms that match the soft jar and orb shapes, and it stays legible at the small sizes cards need.
- Headings are semibold with slight negative tracking. Labels are sentence case. Glow doesn't use uppercase eyebrows or wide-tracked labels.
- The smallest text in the phone app is 11px, used only for badges. Everything else is 12px or larger. The add-on still has 9 to 10px text in about 50 rules (compact cards, counts, captions). Don't add more, and raise them to 11px when you touch them.

## Shape and space

- Radii: 12 for buttons, inputs and notices, 16 for cards, full round for switches, chips and icon circles.
- Cards sit flat with a hairline border. Shadow is only for things that float above the page: sheets, dialogs, toasts and switch knobs.
- Every touch target is at least 44px, through padding, `hitSlop` in the phone app, or an invisible `:after` area in the add-on.

## Icons

- **Lucide**, at 1.5 to 1.8 stroke width. The thin rounded strokes match DM Sans's weight and round terminals, and the set has a glyph for every room style. On iOS the tab bar uses SF Symbols, so it matches the system Liquid Glass bar.
- Every icon names its content: a bulb for a light, layers for a group, the room's own object for a room. Glow doesn't use sparkles, stars or magic icons.

## Copy

- Plain and warm, in second person ("Your rooms come from Home Assistant Areas."). A button says exactly what it does ("Show all scenes", "Open Settings & help").
- No em dashes. Show only real numbers from the home, never made-up statistics.
