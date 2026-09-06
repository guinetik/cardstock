import React from "react";

/** A mono-caps kicker above a title — the quietest label in the system. */
export function Eyebrow({ as: Tag = "p", className = "", children, ...rest }) {
  return <Tag {...rest} className={`eyebrow ${className}`.trim()}>{children}</Tag>;
}
