import React from "react";

const RULE = {
  inbox: "lane-head--soft",
  work: "",
  waiting: "lane-head--waiting",
  built: "lane-head--soft",
  done: "lane-head--soft",
  archive: "lane-head--soft",
};

/** Lane-name ink by kind — the same mapping as KIND_INK in lane-column.tsx. */
export const LANE_INK = {
  inbox: "var(--color-grey)",
  work: "var(--color-ink)",
  waiting: "var(--pen-amber)",
  built: "var(--pen-blue)",
  done: "var(--pen-green)",
  archive: "var(--color-grey)",
};

/**
 * The divider tab at the top of a lane. The rule under the name says what
 * kind of lane it is: ink for work, a hairline for the quiet ones, the amber
 * pen for anything waiting.
 */
export function LaneHead({ name, kind = "work", count, sla, tools, className = "" }) {
  return (
    <div className={`lane-head ${RULE[kind] || ""} ${className}`.trim()}>
      <h2 className="lane-name" style={{ color: LANE_INK[kind] }}>{name}</h2>
      {count != null && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-grey-faint)" }}>
          {count}
        </span>
      )}
      {sla != null && (
        <span style={{ fontSize: "var(--text-stat)", color: "var(--color-grey)" }}>SLA {sla}d</span>
      )}
      {tools && <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.125rem" }}>{tools}</span>}
    </div>
  );
}
