/** Tracker status vocabulary. One card has exactly one of these. */
export const CARD_STATUSES = [
  "backlog",
  "blocked",
  "wip",
  "held",
  "built",
  "handed",
  "shipped",
  "done",
] as const;

/** One value from `CARD_STATUSES`. */
export type CardStatus = (typeof CARD_STATUSES)[number];

/** True when `value` is a tracker status word. */
export function isCardStatus(value: unknown): value is CardStatus {
  return (
    typeof value === "string" &&
    (CARD_STATUSES as readonly string[]).includes(value)
  );
}

const STATUS_CHIP: Record<string, string> = {
  wip: "stat stat--wip",
  built: "stat stat--info",
  handed: "stat stat--info",
  held: "stat stat--muted",
  blocked: "stat stat--blocked",
  shipped: "stat stat--success",
  done: "stat stat--success",
  backlog: "stat stat--muted",
};

/**
 * Class list for a status word — same pens on the card and in the filter bar.
 */
export function statusChipClass(status: string): string {
  return STATUS_CHIP[status] ?? "stat stat--muted";
}

/**
 * Tidy a blocker note — the free-text "waiting on" a card carries. Any
 * non-empty value marks the card blocked, so a stray space must not count as
 * one; blank input clears the note.
 *
 * @param value - Raw text from the editor, or nothing.
 * @returns The trimmed note, or null when there is no blocker.
 */
export function normalizeNeeds(
  value: string | null | undefined,
): string | null {
  return value?.trim() || null;
}
