import { PRIORITY_LABEL } from "./types";

/** Board lane fields History needs to turn ids/keys into names. */
export type CardHistoryLane = {
  id: string;
  key: string;
  name: string;
};

/** One `card_events` row as the card page already selects it. */
export type CardHistoryEvent = {
  id: string;
  actor: string | null;
  kind: string;
  payload: unknown;
  at: string;
};

/** Test hooks. The UI omits both and uses the browser zone and real now. */
export type FormatCardEventOptions = {
  timeZone?: string;
  now?: Date;
};

/** One ledger line. `stat` is the modifier only (`stat--info`, …). */
export type FormattedCardEvent = {
  clock: string;
  kind: string;
  stat: string;
  actor: string;
  facts: string;
};

const EDIT_ORDER = [
  "priority",
  "effort",
  "target_date",
  "target_label",
  "audience",
  "title",
  "summary",
  "tags",
  "body",
] as const;

/**
 * Turn one event into a ledger line: local clock, kind pen, actor, verb clause.
 *
 * Never stringifies `payload`. Unknown kinds still return clock, kind, and actor.
 *
 * @param event - A `card_events` row.
 * @param lanes - The card's board lanes, for id/key → name.
 * @param options - `timeZone` / `now` for tests; omit in the UI.
 */
export function formatCardEvent(
  event: CardHistoryEvent,
  lanes: CardHistoryLane[],
  options?: FormatCardEventOptions,
): FormattedCardEvent {
  return {
    clock: formatClock(event.at, options?.now ?? new Date(), options?.timeZone),
    kind: event.kind,
    stat: statFor(event.kind),
    actor: formatActor(event.actor),
    facts: formatFacts(event.kind, event.payload, lanes),
  };
}

/**
 * Email local-part with a capital first letter, otherwise the trimmed actor.
 * Blank → `someone`. Machine names (`etl`) have no `@` and stay as written.
 */
function formatActor(actor: string | null | undefined): string {
  const raw = actor?.trim() ?? "";
  if (!raw) return "someone";
  if (!raw.includes("@")) return raw;
  const local = raw.slice(0, raw.indexOf("@")).trim();
  if (!local) return "someone";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * `28 Aug 02:28`, with year when it is not `now`'s calendar year in `timeZone`.
 */
function formatClock(at: string, now: Date, timeZone?: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "—";
  const eventYear = calendarYear(date, timeZone);
  const nowYear = calendarYear(now, timeZone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
    ...(eventYear !== nowYear ? { year: "numeric" as const } : {}),
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const day = pick("day");
  const month = pick("month");
  const year = eventYear !== nowYear ? ` ${pick("year")}` : "";
  const hour = pick("hour").padStart(2, "0");
  const minute = pick("minute").padStart(2, "0");
  return `${day} ${month}${year} ${hour}:${minute}`;
}

function calendarYear(date: Date, timeZone?: string): number {
  const year = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    timeZone,
  })
    .formatToParts(date)
    .find((p) => p.type === "year")?.value;
  return Number(year);
}

function statFor(kind: string): string {
  if (kind === "moved" || kind === "restored" || kind === "commented")
    return "stat--info";
  if (kind === "created") return "stat--success";
  return "stat--muted";
}

function asPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function formatFacts(
  kind: string,
  raw: unknown,
  lanes: CardHistoryLane[],
): string {
  const payload = asPayload(raw);
  switch (kind) {
    case "moved":
      return movedFacts(payload, lanes);
    case "imported":
      return importedFacts(payload);
    case "created":
      return createdFacts(payload, lanes);
    case "edited":
      return editedFacts(payload);
    case "archived": {
      const from = laneFact(payload.from_lane, lanes, "a-lane");
      return from ? `archived this from ${from}` : "archived this";
    }
    case "restored": {
      const to = laneFact(payload.to_lane, lanes, "a-lane");
      return to ? `restored this to ${to}` : "restored this";
    }
    case "commented":
      return typeof payload.preview === "string" && payload.preview
        ? `commented: ${payload.preview}`
        : "";
    default:
      return "";
  }
}

function movedFacts(
  payload: Record<string, unknown>,
  lanes: CardHistoryLane[],
): string {
  const from = laneFact(payload.from_lane, lanes, "a-lane");
  const to = laneFact(payload.to_lane, lanes, "a-lane");
  if (from && to) return `moved this from ${from} to ${to}`;
  if (to) return `moved this to ${to}`;
  if (from) return `moved this from ${from}`;
  return "";
}

function importedFacts(payload: Record<string, unknown>): string {
  if (typeof payload.source !== "string" || !payload.source) return "";
  const parts = payload.source.split(/[/\\]/);
  const base = parts[parts.length - 1] || "";
  return base ? `imported ${base}` : "";
}

function createdFacts(
  payload: Record<string, unknown>,
  lanes: CardHistoryLane[],
): string {
  const lane = laneFact(payload.lane, lanes, "key");
  return lane ? `created this in ${lane}` : "created this";
}

/**
 * @param missing - `a-lane` for UUID fields; `key` for ETL lane keys (`created`).
 */
function laneFact(
  idOrKey: unknown,
  lanes: CardHistoryLane[],
  missing: "a-lane" | "key",
): string {
  if (typeof idOrKey !== "string" || idOrKey === "") return "";
  const hit = lanes.find((l) => l.id === idOrKey || l.key === idOrKey);
  if (hit) return hit.name;
  return missing === "a-lane" ? "a lane" : idOrKey;
}

function editedFacts(payload: Record<string, unknown>): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const key of EDIT_ORDER) {
    if (!(key in payload)) continue;
    seen.add(key);
    parts.push(editField(key, payload[key]));
  }
  const extra = Object.keys(payload)
    .filter((key) => !seen.has(key))
    .sort();
  for (const key of extra) parts.push(`changed ${key}`);
  return joinPhrases(parts);
}

/**
 * English list: `a`, `a and b`, `a, b, and c`.
 */
function joinPhrases(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

type EditFieldKey = (typeof EDIT_ORDER)[number];

/**
 * One known `edited` field as a verb clause. Exhaustive on `EDIT_ORDER`
 * so a new key cannot fall through to `"body"`.
 */
function editField(key: EditFieldKey, value: unknown): string {
  switch (key) {
    case "priority":
      if (value === 1 || value === 2 || value === 3)
        return `set priority to ${PRIORITY_LABEL[value]}`;
      return "changed priority";
    case "effort":
      if (value === "L" || value === "M" || value === "H")
        return `set effort to ${value}`;
      return "changed effort";
    case "target_date":
      return typeof value === "string" && value
        ? `set the target date to ${value}`
        : "changed the target date";
    case "target_label":
      return typeof value === "string" && value
        ? `set the target to ${value}`
        : "changed the target label";
    case "audience":
      if (value === "internal") return "marked this internal";
      if (value === "all") return "marked this for everyone";
      return "changed audience";
    case "title":
      return "renamed it";
    case "summary":
      return "rewrote the summary";
    case "tags":
      return "changed the tags";
    case "body":
      return "edited the write-up";
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}
