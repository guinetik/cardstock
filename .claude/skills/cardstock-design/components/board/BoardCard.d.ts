import type { CardTint } from "../stock/PaperCard";

/** A tag as it appears on a card: the word, plus its group's highlighter hue. */
export interface BoardCardTag {
  name: string;
  /** 1-5, from `markHue(groupIndex)` — the group owns the hue, not the tag. */
  hue?: number;
}

/**
 * One filed sheet on a board: id, title, epic, status and the decisions
 * already made, with the back of the card opening on hover.
 *
 * @startingPoint section="Board" subtitle="Board card, resting and open" viewport="700x300"
 */
export interface BoardCardProps {
  /** The tracker's own id — written as `#11` in mono. */
  id: string | number;
  title: React.ReactNode;
  /** The epic name; renders with the book glyph. */
  epic?: string;
  /** Tracker vocabulary: backlog, blocked, wip, held, built, handed, shipped, done. */
  status?: "backlog" | "blocked" | "wip" | "held" | "built" | "handed" | "shipped" | "done";
  /** Raised date, e.g. "Aug 13" — set in mono beside the age gauge. */
  raised?: string;
  /** Timeline assessment: draws a 3px pen rule down the left edge. */
  signal?: "forgotten" | "overdue" | null;
  priority?: 1 | 2 | 3 | null;
  effort?: "L" | "M" | "H" | null;
  /** Highlighter marks, shown on the back of the card only. */
  tags?: BoardCardTag[];
  /** The first paragraph of `## Ask`, editable in the app. */
  note?: React.ReactNode;
  /** Free-text blocker — anything here marks the card blocked. */
  needs?: string;
  /** Days in a waiting lane. */
  days?: number | null;
  /** Past the lane's SLA: the day count turns red. */
  overSla?: boolean;
  tint?: CardTint | null;
  /** `flat` for a slip in the inbox drawer, `overlay` for the card in hand. */
  variant?: "resting" | "flat" | "static" | "overlay";
  /** Left open on the desk — the back of the card stays out. */
  pinned?: boolean;
  /** The pin / maximize / palette rail in the corner opposite the id. */
  rail?: boolean;
  className?: string;
}

export declare function BoardCard(props: BoardCardProps): JSX.Element;
