import React from "react";

/**
 * The pen, written in the margin: six pixels of colour and a word in mono
 * caps. A status, never a filled pill.
 */
export function Stat({ tone = "muted", flat = false, as: Tag = "span", className = "", children, ...rest }) {
  return (
    <Tag {...rest} className={`stat stat--${tone} ${flat ? "stat--flat" : ""} ${className}`.replace(/\s+/g, " ").trim()}>
      {children}
    </Tag>
  );
}

/** Tracker status word to its pen — the same mapping as statusChipClass(). */
export const STATUS_TONE = {
  backlog: "muted",
  blocked: "blocked",
  wip: "wip",
  held: "muted",
  built: "info",
  handed: "info",
  shipped: "success",
  done: "success",
};
