import React from "react";

/**
 * Lane microcosm: a whole board in one row. Columns shrink together rather
 * than scrolling, drawer vs panel stock is the only cue for a lane's kind,
 * and untinted slips take the cockpit pens. A card's own tint always wins.
 */
export function LaneMap({ lanes = [], marked = false, className = "", ...rest }) {
  return (
    <div
      {...rest}
      className={`lane-map ${marked ? "lane-map--marked" : ""} ${className}`.replace(/\s+/g, " ").trim()}
    >
      {lanes.map((lane) => (
        <div key={lane.name} className="lane-map-col" data-kind={lane.kind || "work"}>
          <div className="lane-map-pack">
            {(lane.cells || []).map((cell, i) => (
              <span
                key={i}
                className={`lane-map-cell ${cell.signal ? `lane-map-cell--${cell.signal}` : ""} ${cell.tint ? `card-color--${cell.tint}` : ""}`.replace(/\s+/g, " ").trim()}
              >
                {marked ? cell.glyph : null}
              </span>
            ))}
            {lane.more ? <span className="lane-map-cell lane-map-cell--more">+{lane.more}</span> : null}
          </div>
          <span className="lane-map-tip">{lane.name}</span>
        </div>
      ))}
    </div>
  );
}
