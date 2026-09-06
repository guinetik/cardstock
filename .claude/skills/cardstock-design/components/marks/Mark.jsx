import React from "react";

/**
 * A highlighter swipe — the reader's own hand. Used for tags and nothing
 * else. Hue belongs to the tag *group*, so the same word is the same colour
 * in the filter bar, on the card, and on the card page.
 */
export function Mark({ hue = 2, off = false, as: Tag = "span", className = "", children, ...rest }) {
  return (
    <Tag {...rest} className={`mark mark--${hue} ${off ? "mark--off" : ""} ${className}`.replace(/\s+/g, " ").trim()}>
      {children}
    </Tag>
  );
}

/**
 * Highlighter hue for the nth tag group, in board order: amber, blue, green,
 * violet, red. Red comes last so a red mark stays rare enough to mean
 * something.
 */
export const MARK_HUES = [2, 4, 3, 5, 1];

/** The mark hue for the nth tag group. */
export function markHue(groupIndex) {
  return MARK_HUES[groupIndex % MARK_HUES.length];
}
