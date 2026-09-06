import React from "react";

const VARIANT = {
  ink: "",
  outline: "paper-btn--outline",
  ghost: "paper-btn--ghost",
  danger: "paper-btn--danger",
};

/**
 * The primary action is ink, not a colour — pen blue is for links and P2
 * only. A press is a 1px settle; nothing bounces and nothing shrinks.
 */
export function PaperButton({
  variant = "ink",
  size = "md",
  as: Tag = "button",
  className = "",
  children,
  ...rest
}) {
  return (
    <Tag
      {...rest}
      type={Tag === "button" ? (rest.type ?? "button") : rest.type}
      className={`paper-btn ${VARIANT[variant] || ""} ${size === "sm" ? "paper-btn--sm" : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      {children}
    </Tag>
  );
}

/**
 * An ink-filled key, 28 square, the glyph cut out of it in stock — the tool
 * row on a binder's foot. `pen` writes it in red and lets it carry a word.
 */
export function BinderTool({ pen = false, as: Tag = "button", className = "", children, ...rest }) {
  return (
    <Tag
      {...rest}
      type={Tag === "button" ? (rest.type ?? "button") : rest.type}
      className={`binder-tool ${pen ? "binder-tool--pen" : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      {children}
    </Tag>
  );
}
