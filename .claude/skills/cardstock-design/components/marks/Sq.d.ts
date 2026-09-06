/**
 * A decision written as a filled square: priority P1-P3, effort L/M/H.
 *
 * @startingPoint section="Marks" subtitle="Priority and effort squares, on and off" viewport="700x110"
 */
export interface SqProps {
  /** Pen hue when `on`. */
  pen?: "red" | "amber" | "green" | "blue" | "violet";
  /** Filled. Unset squares are empty with a hairline edge. */
  on?: boolean;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children?: React.ReactNode;
}

export declare function Sq(props: SqProps): JSX.Element;
/** P1 red, P2 blue, P3 violet. */
export declare const PRIORITY_PEN: Record<1 | 2 | 3, SqProps["pen"]>;
/** Effort L green, M amber, H red. */
export declare const EFFORT_PEN: Record<"L" | "M" | "H", SqProps["pen"]>;
