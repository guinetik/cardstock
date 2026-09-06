/** A rubber stamp in the margin, in pen red and off level. One per page. */
export interface StampProps {
  /** Grey instead of red — for "nothing filed". */
  faint?: boolean;
  className?: string;
  children?: React.ReactNode;
}
export declare function Stamp(props: StampProps): JSX.Element;
