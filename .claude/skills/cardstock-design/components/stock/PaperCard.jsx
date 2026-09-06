import React from "react";

const VARIANT = {
  resting: "",
  flat: "paper-card--flat",
  static: "paper-card--static",
  still: "paper-card--still",
  overlay: "paper-card--overlay",
};

/**
 * A sheet of stock. The resting variant lifts towards the pointer; the others
 * opt out for the reasons the design system gives them.
 */
export function PaperCard({
  variant = "resting",
  tint = null,
  pinned = false,
  signal = null,
  as: Tag = "div",
  className = "",
  children,
  ...rest
}) {
  return (
    <Tag
      {...rest}
      data-pinned={pinned ? "true" : undefined}
      data-timeline-signal={signal || undefined}
      className={`paper-card ${VARIANT[variant] || ""} ${tint ? `card-color--${tint}` : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      {children}
    </Tag>
  );
}
