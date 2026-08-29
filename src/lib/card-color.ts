/** Card tints accepted by frontmatter, persistence, and the UI. */
export const CARD_COLORS = [
  "rose",
  "orange",
  "amber",
  "green",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "pink",
] as const;

/** A standardized board-card tint. */
export type CardColor = (typeof CARD_COLORS)[number];

/** Human-readable labels for card color controls. */
export const CARD_COLOR_LABELS: Readonly<Record<CardColor, string>> = {
  rose: "Rose",
  orange: "Orange",
  amber: "Amber",
  green: "Green",
  cyan: "Cyan",
  blue: "Blue",
  indigo: "Indigo",
  violet: "Violet",
  pink: "Pink",
};

/** Return whether an untrusted value is a supported card color. */
export function isCardColor(value: unknown): value is CardColor {
  return typeof value === "string" && CARD_COLORS.includes(value as CardColor);
}

/** Convert an untrusted persisted value to a supported color or neutral. */
export function parseCardColor(value: unknown): CardColor | null {
  return isCardColor(value) ? value : null;
}

/** Return the CSS modifier for a color, or no modifier for a neutral card. */
export function cardColorModifier(
  color: CardColor | null | undefined,
): `card-color--${CardColor}` | null {
  return color ? `card-color--${color}` : null;
}

/** Return the CSS custom-property name used by a color swatch. */
export function cardColorSurfaceToken(
  color: CardColor,
): `--surface-card-${CardColor}` {
  return `--surface-card-${color}`;
}
