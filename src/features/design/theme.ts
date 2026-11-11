/**
 * "Deep space" design tokens. Pure functions only: this module must stay free
 * of React Native imports so the palette can be contrast-tested in Node.
 *
 * Every colour used by a screen should come from `palette()` (through
 * `useTheme()`), never from a literal, so both modes stay legible.
 */
export interface ThemeTokens {
  dark: boolean;
  /** App background. */
  bg: string;
  /** Raised panels and cards. */
  card: string;
  /** Recessed wells: inputs and secondary buttons. */
  inset: string;
  /** Hairlines, tracks and quiet fills. */
  line: string;
  text: string;
  muted: string;
  /** The user's accent, exactly as chosen. Use for fills. */
  accent: string;
  /** Text or icon colour that is readable on top of an accent fill. */
  onAccent: string;
  /** The accent adjusted until it is readable as text or an icon on a panel. */
  accentInk: string;
  /** Translucent accent for panel edges and HUD brackets. */
  glow: string;
  danger: string;
  success: string;
  cyan: string;
  orange: string;
  purple: string;
}

const channels = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** WCAG relative luminance of a #RRGGBB colour. */
export function luminance(hex: string) {
  const [r, g, b] = channels(hex)
    .map((v) => v / 255)
    .map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
    );
  return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
}

/** WCAG contrast ratio between two #RRGGBB colours (1–21). */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Linear blend of two #RRGGBB colours; amount 0 returns `from`, 1 returns `to`. */
export function mix(from: string, to: string, amount: number) {
  const a = channels(from),
    b = channels(to);
  return (
    "#" +
    a
      .map((v, i) =>
        Math.round(v + (b[i]! - v) * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

/**
 * Nudges `color` toward `toward` until it reaches `minimum` contrast on
 * `surface`. A user-selected accent can be any colour, so foreground uses must
 * never assume it is legible.
 */
export function readableInk(
  color: string,
  surface: string,
  toward: string,
  minimum = 4.5,
) {
  for (let step = 0; step <= 10; step++) {
    const candidate = mix(color, toward, step / 10);
    if (contrast(candidate, surface) >= minimum) return candidate;
  }
  return toward;
}

export const DEFAULT_ACCENT = "#00D1FF";

export function palette(dark: boolean, accent: string): ThemeTokens {
  const base = dark
    ? {
        bg: "#05080F",
        card: "#0C1422",
        inset: "#080E19",
        line: "#1C2B40",
        text: "#E8F3FF",
        muted: "#8496B0",
        danger: "#FF5C7A",
        success: "#3DF2B4",
        cyan: "#63E6FF",
        orange: "#FFB45C",
        purple: "#B79CFF",
      }
    : {
        bg: "#EDF2F8",
        card: "#FFFFFF",
        inset: "#F4F7FB",
        line: "#D3DDE9",
        text: "#0A1626",
        muted: "#52647B",
        danger: "#C92444",
        success: "#00785A",
        cyan: "#0A6C8C",
        orange: "#9E5500",
        purple: "#6B4FD8",
      };
  return {
    dark,
    ...base,
    accent,
    onAccent: luminance(accent) > 0.179 ? "#03131C" : "#FFFFFF",
    // Readable on both the page background and panels.
    accentInk: readableInk(accent, dark ? base.card : base.bg, base.text),
    glow: accent + (dark ? "66" : "8C"),
  };
}
