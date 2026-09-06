import React from "react";

/**
 * A margin note clipped to the sheet, not an inverted OS tooltip: a small
 * sheet of stock a fraction off level, a paperclip at the top, and a red
 * pen rule down the inner margin of the note itself.
 */
export function PaperTooltip({ lead, meta, hint, className = "", children, ...rest }) {
  return (
    <div {...rest} className={`paper-tooltip ${className}`.trim()} role="tooltip">
      <svg
        className="paper-tooltip__clip"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 8.5 11 18.5a4.95 4.95 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.67 4.67l-8.5 8.5a1.65 1.65 0 0 1-2.33-2.33L13 7" />
      </svg>
      <div className="paper-tooltip__sheet">
        <div className="paper-tooltip__stack">
          {lead && <p className="paper-tooltip__lead">{lead}</p>}
          {meta && <p className="paper-tooltip__meta">{meta}</p>}
          {hint && <p className="paper-tooltip__hint">{hint}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
