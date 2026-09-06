import React from "react";

/**
 * The letterhead a project or board page opens with: an eyebrow, the title in
 * Newsreader, the blurb, the view links, and a stamp in the margin.
 */
export function Letterhead({ eyebrow, title, blurb, links, aside, className = "", children, ...rest }) {
  return (
    <header {...rest} className={`letterhead ${className}`.trim()}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {blurb && <p className="cta-body">{blurb}</p>}
        {links && (
          <nav
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.9rem",
              marginTop: "0.6rem",
              fontSize: "var(--text-sm)",
            }}
          >
            {links}
          </nav>
        )}
        {children}
      </div>
      {aside && <div className="letterhead-aside">{aside}</div>}
    </header>
  );
}

/** A square portrait — filed, not rounded. Never a circle. */
export function Portrait({ src, alt = "", size = "md", className = "", ...rest }) {
  const mod = { sm: "portrait--sm", md: "", topbar: "portrait--topbar", lg: "portrait--lg" }[size];
  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      className={`portrait ${mod || ""} ${className}`.replace(/\s+/g, " ").trim()}
    />
  );
}
