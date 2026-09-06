/**
 * The highlighter: a swipe the reader made. Used for tags and nothing else.
 *
 * @startingPoint section="Marks" subtitle="Tag highlighter swipes, five group hues" viewport="700x120"
 */
export interface MarkProps {
  /** 1 red · 2 amber · 3 green · 4 blue · 5 violet. Use `markHue(groupIndex)`. */
  hue?: 1 | 2 | 3 | 4 | 5;
  /** Unassigned: the same word under a pencil rule, previewing on hover. */
  off?: boolean;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children?: React.ReactNode;
}

export declare function Mark(props: MarkProps): JSX.Element;
/** Hue order by tag group: amber, blue, green, violet, red. */
export declare const MARK_HUES: readonly number[];
/** The mark hue for the nth tag group on a board. */
export declare function markHue(groupIndex: number): number;
