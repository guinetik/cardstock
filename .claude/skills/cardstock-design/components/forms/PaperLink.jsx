import React from "react";

/**
 * A link in pen blue, underlined only when pointed at. `danger` is the red
 * pen — the same colour the delete ask and the stamp are written in.
 */
export function PaperLink({ danger = false, as: Tag = "a", className = "", children, ...rest }) {
  return (
    <Tag
      {...rest}
      className={`paper-link ${danger ? "paper-link--danger" : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      {children}
    </Tag>
  );
}
