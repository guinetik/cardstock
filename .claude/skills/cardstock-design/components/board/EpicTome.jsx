import React from "react";

/**
 * An epic drawn as a closed tome on the desk: cloth spine down the left
 * taking the outlook pen, the page block peeking out past the cover at the
 * bottom right. Two shapes, one drawing — `tile` is the shelved cockpit
 * card, `slip` is the smaller one a task is dragged onto.
 */
export function EpicTome({ outlook = "planning", shape = "tile", over = false, className = "", children, ...rest }) {
  const base = shape === "slip" ? "epic-tome" : "cockpit-epic";
  return (
    <article
      {...rest}
      data-outlook={outlook}
      className={`${base} ${shape === "tile" ? `cockpit-epic--${outlook}` : ""} ${over ? "epic-tome--over" : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      {children}
    </article>
  );
}
