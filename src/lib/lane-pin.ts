/**
 * A pinned lane stays in view while the rest of the board scrolls past it.
 *
 * This is the per-viewer half of lane placement, and it is deliberately not
 * the same mechanism as lane *order*. Order is `lanes.position`, a shared
 * column: moving a lane moves it for everyone, because a board whose columns
 * mean different things to different people is not a board. A pin moves
 * nothing — it is one person's view of an order the team agreed on.
 *
 * Unlike collapsed/maximised lane views, which live server-side in
 * `members.prefs.laneViews`, a pin lives in the browser. It is a per-screen
 * convenience rather than something worth carrying between devices, and the
 * price of that is that it does not follow you from desktop to laptop.
 */

/** Pinned lane id, keyed by board id. One pin per board. */
export type StoredBoardPins = Record<string, string>;

export const LANE_PIN_STORAGE_KEY = "cardstock:lane-pins";

/**
 * Keep only `boardId -> laneId` string pairs from unknown JSON.
 *
 * Everything here has been through `localStorage`, which is to say through
 * whatever a previous version of this app wrote and whatever a person has
 * typed into devtools. Nothing about its shape is guaranteed.
 */
export function parseBoardPins(raw: unknown): StoredBoardPins {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: StoredBoardPins = {};
  for (const [boardId, laneId] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (typeof laneId === "string" && laneId !== "") out[boardId] = laneId;
  }
  return out;
}

/**
 * Set or clear one board's pin without disturbing any other board's.
 * A null lane id removes the entry rather than storing an empty one.
 */
export function setBoardPin(
  all: unknown,
  boardId: string,
  laneId: string | null,
): StoredBoardPins {
  const next = parseBoardPins(all);
  if (laneId) next[boardId] = laneId;
  else delete next[boardId];
  return next;
}

/**
 * The pin for one board, or null. A pin naming a lane that no longer exists
 * — deleted by someone else, or on a board this person has not loaded since
 * — reads as no pin at all, rather than as a stuck empty column.
 */
export function pinnedLaneId(
  all: unknown,
  boardId: string,
  laneIds: readonly string[],
): string | null {
  const pinned = parseBoardPins(all)[boardId];
  return pinned && laneIds.includes(pinned) ? pinned : null;
}

/**
 * Read every board's pins from browser storage.
 *
 * Storage throws rather than returning empty in more cases than it looks:
 * a private window, a browser set to block site data, a thumbnail capture.
 * A board that cannot read a pin still has to render.
 */
export function readBoardPins(): StoredBoardPins {
  try {
    const raw = window.localStorage.getItem(LANE_PIN_STORAGE_KEY);
    return raw ? parseBoardPins(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/** Persist every board's pins, silently accepting that storage may refuse. */
export function writeBoardPins(pins: StoredBoardPins): void {
  try {
    window.localStorage.setItem(LANE_PIN_STORAGE_KEY, JSON.stringify(pins));
  } catch {
    // A pin that cannot be saved is a pin that lasts until reload. That is a
    // better outcome than a board that throws while someone is using it.
  }
}
