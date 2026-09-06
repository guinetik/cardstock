/**
 * A link in pen blue, underlined only on hover.
 */
export interface PaperLinkProps {
  /** The red pen: destructive asks and archive-with-attribution. */
  danger?: boolean;
  /** `a` by default; `button` for an in-place action that reads as a link. */
  as?: keyof JSX.IntrinsicElements;
  href?: string;
  onClick?: React.MouseEventHandler;
  className?: string;
  children?: React.ReactNode;
}

export declare function PaperLink(props: PaperLinkProps): JSX.Element;
