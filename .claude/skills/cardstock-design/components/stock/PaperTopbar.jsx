import React from "react";

/**
 * The app bar: card stock with a ruled bottom edge. cardstock has no logo —
 * the wordmark is the product name set in Newsreader, lowercase.
 */
export function PaperTopbar({ brand = "cardstock", href = "/", right, className = "", ...rest }) {
  return (
    <header
      {...rest}
      className={`paper-topbar ${className}`.trim()}
      style={{ display: "flex", height: "var(--topbar-height)", flexShrink: 0, alignItems: "center", justifyContent: "space-between", padding: "0 1rem", ...rest.style }}
    >
      <a href={href} style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: 600, letterSpacing: "var(--display-tracking)", color: "var(--color-ink-strong)", textDecoration: "none" }}>
        {brand}
      </a>
      {right}
    </header>
  );
}
