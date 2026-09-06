import React from "react";

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
];

const LABEL = {
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

/**
 * The nine card tints plus a struck-through "no tint" choice. Swatches are
 * the one round thing in the product: they are ink wells, not paper.
 */
export function ColorPicker({ value = null, onChange, className = "", ...rest }) {
  return (
    <fieldset {...rest} className={`card-color-picker ${className}`.trim()}>
      <button
        type="button"
        aria-label="No tint"
        aria-pressed={value === null}
        className="card-color-choice card-color-choice--none"
        onClick={() => onChange?.(null)}
      />
      {CARD_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={LABEL[c]}
          aria-pressed={value === c}
          className="card-color-choice"
          style={{ background: `var(--surface-card-${c})` }}
          onClick={() => onChange?.(c)}
        />
      ))}
    </fieldset>
  );
}
