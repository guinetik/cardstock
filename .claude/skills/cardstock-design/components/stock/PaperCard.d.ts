/** The nine frontmatter-owned pastel tints a sheet can carry. */
export type CardTint =
  | "rose" | "orange" | "amber" | "green" | "cyan"
  | "blue" | "indigo" | "violet" | "pink";

/**
 * A sheet of stock — the base surface for every card in cardstock.
 *
 * @startingPoint section="Stock" subtitle="Sheet, drawer slip, page sheet, drag ghost" viewport="700x260"
 */
export interface PaperCardProps {
  /**
   * `resting` lifts and foreshortens under the pointer (a sheet nearer the
   * eye). `flat` is a loose slip in the inbox drawer — no side edges, no lift
   * at rest. `static` is a page-scale sheet that ignores the pointer. `still`
   * is a form sheet: focus inside a field must not pull the whole thing
   * forward. `overlay` is the card in hand — the only rotation in the product.
   */
  variant?: "resting" | "flat" | "static" | "still" | "overlay";
  /** Pastel tint from the card's frontmatter; null keeps neutral paper. */
  tint?: CardTint | null;
  /** Left open on the desk: keeps the lifted shadow and the peek out. */
  pinned?: boolean;
  /** Draws a 3px pen rule down the left edge. */
  signal?: "forgotten" | "overdue" | null;
  /** Element to render. Board cards are `article`. */
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children?: React.ReactNode;
}

export declare function PaperCard(props: PaperCardProps): JSX.Element;
