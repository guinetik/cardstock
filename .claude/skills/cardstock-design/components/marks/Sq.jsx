import React from "react";

/**
 * A decision the app recorded, written as a filled square: priority P1-P3,
 * effort L/M/H. Unset, it is an empty square with a hairline edge.
 */
export function Sq({ pen = "blue", on = false, as: Tag = "span", className = "", children, ...rest }) {
  return (
    <Tag {...rest} className={`sq ${on ? `sq--on sq--${pen}` : ""} ${className}`.replace(/\s+/g, " ").trim()}>
      {children}
    </Tag>
  );
}

/** P1 red, P2 blue, P3 violet. */
export const PRIORITY_PEN = { 1: "red", 2: "blue", 3: "violet" };
/** Effort L green, M amber, H red. */
export const EFFORT_PEN = { L: "green", M: "amber", H: "red" };
