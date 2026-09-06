/** One slip in the microcosm. */
export interface LaneMapCell {
  /** Cockpit pen when the card carries no tint of its own. */
  signal?: "queued" | "moving" | "late" | "blocked" | "delivered";
  /** The card's frontmatter tint — always wins over `signal`. */
  tint?: string;
  /** A task-cabin mark (✓ ! ◷ →), shown only when `marked`. */
  glyph?: string;
}

/** One column in the microcosm. */
export interface LaneMapLane {
  name: string;
  kind?: "inbox" | "work" | "waiting" | "built" | "done" | "archive";
  cells?: LaneMapCell[];
  /** Slips beyond the ones drawn, written as "+n" across the pack. */
  more?: number;
}

/**
 * A whole board drawn as one row of shrinking columns — the board preview on
 * a wide `Binder`.
 *
 * @startingPoint section="Filing" subtitle="Whole-board microcosm in one row" viewport="700x120"
 */
export interface LaneMapProps {
  lanes?: LaneMapLane[];
  /** Taller slips carrying the task marks instead of bare colour. */
  marked?: boolean;
  className?: string;
}

export declare function LaneMap(props: LaneMapProps): JSX.Element;
