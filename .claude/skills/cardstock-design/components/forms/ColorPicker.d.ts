import type { CardTint } from "../stock/PaperCard";

/**
 * The card-tint palette: nine pastels and a struck-through "no tint".
 *
 * @startingPoint section="Forms" subtitle="Nine card tints plus no-tint" viewport="700x110"
 */
export interface ColorPickerProps {
  /** The tint currently on the card, or null for neutral stock. */
  value?: CardTint | null;
  onChange?: (next: CardTint | null) => void;
  className?: string;
}

export declare function ColorPicker(props: ColorPickerProps): JSX.Element;

/** The nine tints, in palette order. */
export declare const CARD_COLORS: readonly CardTint[];
