/** An epic name with the book icon — the same story everywhere it appears. */
export interface EpicLabelProps {
  name: string;
  /** Tighter uppercase styling for dense lists (timeline, tables). */
  compact?: boolean;
  className?: string;
}
export declare function EpicLabel(props: EpicLabelProps): JSX.Element;
