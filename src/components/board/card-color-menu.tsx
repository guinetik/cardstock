"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CARD_COLOR_LABELS,
  type CardColor,
  cardColorSurfaceToken,
} from "@/lib/card-color";
import { CardColorPicker } from "./card-color-picker";

/** Props for {@link CardColorMenu}. */
export interface CardColorMenuProps {
  /** Currently selected tint, or neutral when `null`. */
  value: CardColor | null;
  /** Called when the user selects a tint or clears to neutral. */
  onChange: (color: CardColor | null) => void;
  /** Card number, so the palette says which card it tints. */
  externalId: string;
}

/**
 * The tint control as a rail button: a dot wearing the card's own colour,
 * opening the palette over the board. The full row of swatches costs a card
 * form row it does not earn — this way the tint lives with pin and maximize,
 * which are the other things you do *to* a card rather than write *on* it.
 */
export function CardColorMenu({
  value,
  onChange,
  externalId,
}: CardColorMenuProps) {
  const label = value ? CARD_COLOR_LABELS[value] : "No color";
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Color for card #${externalId}`}
        title={`Color — ${label}`}
        // The rail sits inside the drag handle; a press here is a press, not
        // the start of picking the card up.
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span
          aria-hidden="true"
          className={`card-rail-swatch${value ? "" : " card-rail-swatch--none"}`}
          style={
            value
              ? { background: `var(${cardColorSurfaceToken(value)})` }
              : undefined
          }
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Five to a row: the palette reads as a paint box, not a ruler. */}
        <div className="w-[9.75rem]">
          <CardColorPicker
            value={value}
            onChange={onChange}
            label={`Color for card #${externalId}`}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
