import React from "react";

/**
 * A board drawn as a binder: a riveted spine of the folder's own stock, the
 * board's name on the cover, its card count, and the keys on the foot. The
 * cover link fills the binder, so the tools sit above it on their own layer.
 */
export function Binder({
  name,
  href,
  count,
  wide = false,
  tools,
  links,
  stacked = false,
  className = "",
  children,
  ...rest
}) {
  return (
    <li
      {...rest}
      className={`binder ${wide ? "binder--wide" : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      <span className="binder-rivets" aria-hidden="true" />
      <h2 className="binder-name">
        {href ? (
          <a href={href} className="binder-open">
            {name}
          </a>
        ) : (
          name
        )}
      </h2>
      {count != null && <p className="binder-count">{count}</p>}
      {children}
      {(tools || links) && (
        <div
          className={`binder-foot ${tools ? "binder-foot--tools" : ""} ${stacked ? "binder-foot--stacked" : ""}`.replace(/\s+/g, " ").trim()}
        >
          {tools && <span className="binder-io">{tools}</span>}
          {links && <span className="binder-links">{links}</span>}
        </div>
      )}
    </li>
  );
}
