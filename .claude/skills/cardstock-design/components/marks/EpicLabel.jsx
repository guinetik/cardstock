import React from "react";
import { Icon } from "../icon/Icon.jsx";

/**
 * An epic name with the book icon, so the same story reads the same way on
 * the board, the timeline and the filter bar.
 */
export function EpicLabel({ name, compact = false, className = "", ...rest }) {
  return (
    <span {...rest} className={`epic-label ${compact ? "epic-label--compact" : ""} ${className}`.replace(/\s+/g, " ").trim()}>
      <Icon name="book" size={13} className="epic-label__icon" />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </span>
  );
}
