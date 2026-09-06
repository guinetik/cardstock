/**
 * The pen: a decision the app recorded, written in the margin as six pixels
 * of colour and a word in mono caps. Never a filled pill.
 *
 * @startingPoint section="Marks" subtitle="Status pens: wip, blocked, info, success" viewport="700x120"
 */
export interface StatProps {
  /** Which pen. `danger` and `blocked` are the same red. */
  tone?: "wip" | "blocked" | "info" | "success" | "attention" | "muted" | "danger" | "ink" | "faint";
  /** Drop the 6px colour block and keep only the word. */
  flat?: boolean;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children?: React.ReactNode;
}

export declare function Stat(props: StatProps): JSX.Element;
/** Tracker status word to pen tone, the same mapping as `statusChipClass()`. */
export declare const STATUS_TONE: Record<string, StatProps["tone"]>;
