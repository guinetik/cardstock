import type { CardTint } from "../stock/PaperCard";

/**
 * A dated card as a canary post-it — a numbered stub on a day sheet, or a
 * titled slip in the unscheduled tray.
 *
 * @startingPoint section="Board" subtitle="Post-it stub and tray slip" viewport="700x140"
 */
export interface CalendarSlipProps {
  id: string | number;
  /** Shown on the `full` shape only; a stub carries the id alone. */
  title?: React.ReactNode;
  /** The board the card came from, in mono at 9px. */
  board?: string;
  /** `stub` on a day sheet, `full` in the tray. */
  shape?: "stub" | "full";
  /** A card's own tint wins over the canary default. */
  tint?: CardTint | null;
  /** Degrees of hand-placed tilt on a stub, e.g. -2 to 2. */
  tilt?: number;
  /** In hand: -3°, 1.08 scale, and the shadow falls clear of the grid. */
  lift?: boolean;
  className?: string;
}

export declare function CalendarSlip(props: CalendarSlipProps): JSX.Element;
