import React from "react";

/**
 * A rubber stamp in the margin, in pen red and off level. The one tilted
 * thing on a page besides a dragged card — so a page gets at most one.
 */
export function Stamp({ faint = false, className = "", children, ...rest }) {
  return (
    <span {...rest} aria-hidden="true" className={`folder-stamp ${faint ? "folder-stamp--faint" : ""} ${className}`.replace(/\s+/g, " ").trim()}>
      {children}
    </span>
  );
}
