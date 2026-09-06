/**
 * The divider tab at the top of a lane: name, count, and the rule that says
 * what kind of lane it is.
 */
export interface LaneHeadProps {
  name: string;
  /** Sets both the rule (ink / hairline / amber) and the name's ink. */
  kind?: "inbox" | "work" | "waiting" | "built" | "done" | "archive";
  /** `3`, or `2/7` when a filter is hiding some. */
  count?: string | number;
  /** Days a card may sit in a waiting lane before the badge turns red. */
  sla?: number | null;
  /** Right-aligned tool cluster (add, manage, maximize, minimize). */
  tools?: React.ReactNode;
  className?: string;
}

export declare function LaneHead(props: LaneHeadProps): JSX.Element;
/** Lane-name ink by kind, keyed the same way as the app's KIND_INK. */
export declare const LANE_INK: Record<string, string>;
