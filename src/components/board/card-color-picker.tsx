"use client";

import {
  CARD_COLOR_LABELS,
  CARD_COLORS,
  type CardColor,
  cardColorSurfaceToken,
} from "@/lib/card-color";

/** Props for {@link CardColorPicker}. */
export interface CardColorPickerProps {
  /** Currently selected tint, or neutral when `null`. */
  value: CardColor | null;
  /** Called when the user selects a tint or clears to neutral. */
  onChange: (color: CardColor | null) => void;
  /** When true, color choices cannot be activated. */
  disabled?: boolean;
  /** Accessible name for the color choice group. */
  label?: string;
}

/** Select or clear a standardized card or lane tint. */
export function CardColorPicker({
  value,
  onChange,
  disabled = false,
  label = "Card color",
}: CardColorPickerProps) {
  return (
    <fieldset aria-label={label} className="card-color-picker">
      <button
        type="button"
        aria-pressed={value === null}
        aria-label="No color"
        title="No color"
        className="card-color-choice card-color-choice--none"
        onClick={() => onChange(null)}
        disabled={disabled}
      >
        <span className="sr-only">No color</span>
      </button>
      {CARD_COLORS.map((color) => (
        <CardColorSwatch
          key={color}
          color={color}
          selected={value === color}
          disabled={disabled}
          onSelect={() => onChange(color)}
        />
      ))}
    </fieldset>
  );
}

interface CardColorSwatchProps {
  color: CardColor;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}

/** One tint swatch in {@link CardColorPicker}. */
function CardColorSwatch({
  color,
  selected,
  disabled,
  onSelect,
}: CardColorSwatchProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={CARD_COLOR_LABELS[color]}
      title={CARD_COLOR_LABELS[color]}
      className="card-color-choice"
      style={{
        background: `var(${cardColorSurfaceToken(color)})`,
      }}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="sr-only">{CARD_COLOR_LABELS[color]}</span>
    </button>
  );
}
