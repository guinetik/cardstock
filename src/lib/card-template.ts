/**
 * Per-board new-card template, stored in board settings like gates and
 * timeline statuses. The value is plain markdown — typically the `##`
 * section skeleton the board's sync validator requires — served as the
 * starting body whenever a card is created without one.
 */

export const CARD_TEMPLATE_SETTING = "card_template";

/** Longest template we will store; a template is a skeleton, not a wiki. */
export const CARD_TEMPLATE_MAX = 20_000;

export function cardTemplate(
  settings: Record<string, unknown> | null | undefined,
): string {
  const raw = settings?.[CARD_TEMPLATE_SETTING];
  return typeof raw === "string" ? raw.trim() : "";
}
