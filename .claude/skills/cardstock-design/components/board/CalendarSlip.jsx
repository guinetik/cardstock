import React from "react";

/**
 * A card with a target date, drawn as a post-it. On a day sheet it is a
 * `stub` — a tilted square of canary stock carrying nothing but the id. In
 * the unscheduled tray it is `full`: id, title, board.
 */
export function CalendarSlip({
  id,
  title,
  board,
  shape = "full",
  tint = null,
  tilt = 0,
  lift = false,
  className = "",
  ...rest
}) {
  return (
    <article
      {...rest}
      style={shape === "stub" ? { "--slip-tilt": `${tilt}deg`, ...rest.style } : rest.style}
      className={`paper-card paper-card--static calendar-slip ${shape === "stub" ? "calendar-slip--stub" : ""} ${lift ? "calendar-slip--lift" : ""} ${tint ? `card-color--${tint}` : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      {shape === "stub" ? (
        <span className="calendar-slip-id">#{id}</span>
      ) : (
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ display: "flex", gap: "0.28rem", alignItems: "baseline", minWidth: 0 }}>
            <span className="calendar-slip-id">#{id}</span>
            <p className="calendar-slip-title">{title}</p>
          </span>
          {board && <p className="calendar-slip-board">{board}</p>}
        </span>
      )}
    </article>
  );
}
