/**
 * Per-board lane width choice: maximized, collapsed to a tab, or the default.
 * Empty string is the default and is not stored.
 */
export type LaneViewMode = "max" | "min" | "";

/** Stored (non-default) lane views for one board. */
export type StoredLaneView = Record<string, "max" | "min">;

/** Stored lane views keyed by board id. */
export type StoredBoardLaneViews = Record<string, StoredLaneView>;

/**
 * Keep only `"max"` / `"min"` entries from unknown JSON (member prefs).
 */
export function parseLaneView(raw: unknown): StoredLaneView {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: StoredLaneView = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "max" || value === "min") out[id] = value;
  }
  return out;
}

/**
 * Drop default (`""`) views so they are not written to prefs.
 */
export function compactLaneView(
  view: Record<string, LaneViewMode>,
): StoredLaneView {
  const out: StoredLaneView = {};
  for (const [id, value] of Object.entries(view)) {
    if (value === "max" || value === "min") out[id] = value;
  }
  return out;
}

/**
 * Replace one board's lane views without clobbering other boards.
 * An empty map removes that board's key.
 */
export function mergeBoardLaneViews(
  all: unknown,
  boardId: string,
  views: StoredLaneView,
): StoredBoardLaneViews {
  const next: StoredBoardLaneViews = {};
  if (all && typeof all === "object" && !Array.isArray(all)) {
    for (const [id, value] of Object.entries(all as Record<string, unknown>)) {
      const parsed = parseLaneView(value);
      if (Object.keys(parsed).length > 0) next[id] = parsed;
    }
  }
  if (Object.keys(views).length === 0) delete next[boardId];
  else next[boardId] = views;
  return next;
}
