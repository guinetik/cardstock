import React from "react";

/**
 * A column of stock laid on the desk. Every lane paints its own background,
 * so an empty lane still reads as a place to put something.
 */
export function PaperLane({
  kind = "work",
  tint = null,
  collapsed = false,
  over = false,
  pinned = false,
  width = "default",
  className = "",
  children,
  ...rest
}) {
  const measure =
    collapsed || width === "spine"
      ? ""
      : width === "max"
        ? "lane-column-width--max"
        : "lane-column-width";
  return (
    <section
      {...rest}
      data-kind={kind}
      data-pinned={pinned ? "true" : undefined}
      style={collapsed ? { width: "var(--lane-spine-width)", ...rest.style } : rest.style}
      className={`paper-lane ${collapsed ? "lane-spine" : ""} ${kind === "inbox" && !collapsed ? "paper-lane--drawer" : ""} ${over ? "paper-lane--over" : ""} ${pinned ? "paper-lane--pinned" : ""} ${tint ? `lane-color--${tint}` : ""} ${measure} ${className}`.replace(/\s+/g, " ").trim()}
    >
      {children}
    </section>
  );
}
