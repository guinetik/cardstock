/**
 * A clipped margin note — cardstock's tooltip. Never the inverted OS default.
 *
 * @startingPoint section="Filing" subtitle="Clipped margin note" viewport="700x180"
 */
export interface PaperTooltipProps {
  /** The first line, in ink at normal weight. */
  lead?: React.ReactNode;
  /** A quieter second line: dates, keys, counts. */
  meta?: React.ReactNode;
  /** What to do about it, in ink2. */
  hint?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export declare function PaperTooltip(props: PaperTooltipProps): JSX.Element;
