import React from "react";

/** Stock cut *into* the desk — a sunken tray with an inset edge. */
export function PaperWell({ as: Tag = "div", className = "", children, ...rest }) {
  return <Tag {...rest} className={`paper-well ${className}`.trim()}>{children}</Tag>;
}
