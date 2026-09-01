"use client";

import { Palette } from "lucide-react";
import { useState } from "react";
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
  const [open, setOpen] = useState(false);
  const label = value ? CARD_COLOR_LABELS[value] : "No color";

  function selectColor(color: CardColor | null) {
    onChange(color);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="card-color-trigger"
        aria-label={`Color for card #${externalId}`}
        title={`Color — ${label}`}
        // The rail sits inside the drag handle; a press here is a press, not
        // the start of picking the card up.
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={
          value
            ? { background: `var(${cardColorSurfaceToken(value)})` }
            : undefined
        }
      >
        <Palette aria-hidden="true" size={14} strokeWidth={2.2} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto"
        // A mouse pick should release the card as the palette closes. Keyboard
        // users return to the trigger so they keep a predictable tab stop.
        finalFocus={(interactionType) => interactionType === "keyboard"}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Five to a row: the palette reads as a paint box, not a ruler. */}
        <div className="w-[9.75rem]">
          <CardColorPicker
            value={value}
            onChange={selectColor}
            label={`Color for card #${externalId}`}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
