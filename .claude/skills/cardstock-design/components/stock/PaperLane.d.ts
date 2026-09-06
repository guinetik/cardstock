/** Lane behaviour comes from `kind`; names come from the board's seed. */
export type LaneKind = "inbox" | "work" | "waiting" | "built" | "done" | "archive";

/**
 * One kanban column: a column of its own stock, so an empty lane still reads
 * as a place to put something rather than a hole in the page.
 *
 * @startingPoint section="Stock" subtitle="Work lane, inbox drawer, collapsed spine" viewport="700x300"
 */
export interface PaperLaneProps {
  /** `inbox` renders as the drawer — sunken well stock with an inset edge. */
  kind?: LaneKind;
  /** Optional lane tint, shared with the card colour palette. */
  tint?: "rose" | "orange" | "amber" | "green" | "cyan" | "blue" | "indigo" | "violet" | "pink" | null;
  /** Collapsed to its own tab edge — still a drop target. */
  collapsed?: boolean;
  /** A card is held over this lane. */
  over?: boolean;
  /** Held at the left edge while the rest of the board scrolls under it. */
  pinned?: boolean;
  /** `default` is clamp(280px, 22vw, 420px); `max` is min(880px, 44vw). */
  width?: "default" | "max" | "spine";
  className?: string;
  children?: React.ReactNode;
}

export declare function PaperLane(props: PaperLaneProps): JSX.Element;
