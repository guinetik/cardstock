import { BookIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Props for {@link EpicLabel}. */
export interface EpicLabelProps {
  /** Epic name as stored on the card. */
  name: string;
  /** Tighter uppercase styling for dense lists (timeline, tables). */
  compact?: boolean;
  className?: string;
}

/**
 * Epic name with the book icon used on the timeline and board cards so the
 * same story reads the same way everywhere.
 */
export function EpicLabel({ name, compact, className }: EpicLabelProps) {
  return (
    <span
      className={cn(
        "epic-label inline-flex min-w-0 max-w-full items-center gap-1 truncate",
        compact && "epic-label--compact",
        className,
      )}
    >
      <BookIcon className="epic-label__icon shrink-0" aria-hidden="true" />
      <span className="sr-only">Epic </span>
      <span className="truncate">{name}</span>
    </span>
  );
}
