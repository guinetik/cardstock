/**
 * Browser-notification copy and preferences, kept pure so the board hook
 * stays a thin shell around the Notification API. The prefs live under
 * `members.prefs.notifications`; kinds default to on so that flipping the
 * master switch is one gesture, but the whole feature defaults to off —
 * nobody gets a popup they never asked for.
 */

export interface NotificationPrefs {
  enabled: boolean;
  kinds: { created: boolean; moved: boolean; commented: boolean };
}

export function notificationPrefs(raw: unknown): NotificationPrefs {
  const o =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const kinds =
    typeof o.kinds === "object" && o.kinds !== null
      ? (o.kinds as Record<string, unknown>)
      : {};
  return {
    enabled: o.enabled === true,
    kinds: {
      created: kinds.created !== false,
      moved: kinds.moved !== false,
      commented: kinds.commented !== false,
    },
  };
}

/** A `card_events` row as the realtime channel delivers it. */
export interface CardEventRow {
  actor: string | null;
  kind: string;
  card_id: string;
  payload: Record<string, unknown> | null;
}

export interface CardEventNotice {
  title: string;
  body?: string;
  tag: string;
}

const MAX_TITLE = 60;

function shortTitle(title: string): string {
  return title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title;
}

/** The human behind an actor email: the local part is name enough. */
function actorLabel(email: string): string {
  return email.split("@")[0] ?? email;
}

/**
 * Turn one card event into notification copy, or null when it should stay
 * silent: notifications off, the kind muted, an unhandled kind, or the
 * member's own action echoing back.
 */
export function cardEventNotice(
  event: CardEventRow,
  ctx: {
    selfEmail: string;
    prefs: NotificationPrefs;
    cardTitle: (cardId: string) => string | undefined;
    laneName: (laneId: string) => string | undefined;
  },
): CardEventNotice | null {
  if (!ctx.prefs.enabled) return null;
  if (!event.actor || event.actor === ctx.selfEmail) return null;
  const kind = event.kind;
  if (kind !== "created" && kind !== "moved" && kind !== "commented")
    return null;
  if (!ctx.prefs.kinds[kind]) return null;

  const who = actorLabel(event.actor);
  const payload = event.payload ?? {};
  const title = ctx.cardTitle(event.card_id);
  const card = title ? `“${shortTitle(title)}”` : "a card";
  const lane = (key: string) => {
    const id = payload[key];
    return typeof id === "string" ? ctx.laneName(id) : undefined;
  };
  const tag = `card:${event.card_id}`;

  if (kind === "created") {
    const laneName = lane("lane_id");
    return {
      title: `${who} created ${card}`,
      ...(laneName ? { body: `In ${laneName}` } : {}),
      tag,
    };
  }
  if (kind === "moved") {
    const laneName = lane("to_lane");
    return {
      title: `${who} moved ${card}`,
      ...(laneName ? { body: `To ${laneName}` } : {}),
      tag,
    };
  }
  const preview = payload.preview;
  return {
    title: `${who} commented on ${card}`,
    ...(typeof preview === "string" && preview ? { body: preview } : {}),
    tag,
  };
}
