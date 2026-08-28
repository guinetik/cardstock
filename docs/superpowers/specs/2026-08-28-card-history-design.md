# Card history — ledger lines

**Date:** 2026-08-28
**Status:** approved in conversation; implementation follows this document.
**Origin:** the card detail History section dumps `card_events` as timestamp, kind, actor, and `JSON.stringify(payload)` on one truncated row. Hashes and lane UUIDs crowd out what happened.

---

## The problem

History is the card’s stamp log. Today it is a debug dump. A reader cannot scan who moved the card, which lane it left, or which file the ETL read, because the payload is raw JSON and the identifiers in it are UUIDs.

## What we're building

Replace the dump with a **date-gutter ledger**. Each event is one row:

```
[ 28 Aug 02:28 ]  [ MOVED ]  joao    Now → Next
```

No JSON on the row. No disclosure. The sentence is the record. Unknown or unmapped events still get clock, kind, and actor — never a dump.

No behaviour change to writes, ETL, auth, or the 50-event cap. Comments stay comments (`body_md`); History stays `card_events`.

---

## Decisions taken

1. **Ledger line, not a narrative sentence.** Kind is a `.stat`. Facts are the rest of the row. No “this card was”.
2. **Payload is gone from the UI.** The database still stores it. The page does not render it.
3. **Clock on every row.** Local time, `d MMM HH:mm` (`28 Aug 02:28`). Year only when the event’s local calendar year is not the viewer’s current year (`28 Aug 2025 02:28`). No seconds. No day grouping. No relative time.
4. **Lane names, not ids.** Resolve `from_lane` / `to_lane` / `lane` through the board’s lanes (id or key → `name`). Unknown → `a lane`.
5. **Actor is the local-part.** `joao@staffeto.com` → `joao`. `etl` stays `etl`. Missing or blank → `someone`. Do not title-case or invent display names.
6. **Existing pens only.** No new `.stat` variants, no new theme tokens, no nested card inside the page sheet.

---

## The line

Three columns, baseline-aligned, `text-xs`. No nested `.paper-card` / `.paper-lane`.

| Column | Type | Content |
|---|---|---|
| Clock | IBM Plex Mono, muted, tabular | `<time dateTime={iso}>` with the formatted stamp. `suppressHydrationWarning` on that node so SSR and the browser zone do not fight. Invalid `at` → `—`. |
| Kind | `.stat` + the modifier below | The verb as stored, already uppercase in `.stat`. |
| Body | actor then facts | Actor in mono, muted. Facts in Plex Sans, ink. Facts wrap; they are not ellipsized. |

Empty list: a muted paragraph `Nothing recorded.` Heading stays an `h2` whose accessible name is `History` (e2e keys off it). Cap stays 50, newest first, as the page already queries.

### Kind pens

| `kind` | class |
|---|---|
| `moved`, `restored`, `commented` | `stat--info` |
| `created` | `stat--success` |
| `imported`, `edited`, `archived`, anything else | `stat--muted` |

### Actor

- If `actor` contains `@`, take the substring before the first `@`, trimmed. Empty local-part → `someone`.
- Otherwise use the trimmed string (`etl`).
- Null, undefined, or whitespace → `someone`.

### Clock

`Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })` assembled from `formatToParts` so the stamp is always `{day} {month}[ {year}] {hour}:{minute}` with no comma. `timeZone` is injected in tests; the UI omits it (browser local). “This year” is the calendar year in that same zone.

---

## Facts

The formatter never stringifies `payload`. It reads known keys and returns a short string, or `""` when there is nothing to say.

Treat `payload` that is not a plain object as empty.

### `moved`

`from_lane` and `to_lane` are lane ids.

- both resolved: `Now → Next`
- only to: `→ Next`
- only from: `Now →`
- neither: `""`

Do not show `rank`.

### `imported`

- `source`: last path segment (`foo/bar/156.md` and `foo\\bar\\156.md` → `156.md`). If `source` is missing or not a string, skip it.
- Do not show `hash`, `status`, or `lane`.

### `created`

Landing lane from `payload.lane` (ETL writes the lane **key**). Resolve key → name, else show the key if it is a non-empty string, else `""`. Do not show `hash` or `source`.

### `edited`

Walk a fixed field order, then any other own keys alphabetically. Known fields:

| payload key | fact |
|---|---|
| `priority` | `priority P1` / `P2` / `P3` when the value is 1, 2, or 3; otherwise `priority` |
| `effort` | `effort L` / `M` / `H` when the value is that letter; otherwise `effort` |
| `target_date` | the stored date string when it is a non-empty string; otherwise `target date` |
| `target_label` | the stored label when it is a non-empty string; otherwise `target label` |
| `audience` | `audience internal` / `audience all` when the value is that string; otherwise `audience` |
| `title` | `title` |
| `summary` | `summary` |
| `tags` | `tags` |
| `body` | `body` |

Any other key contributes its key name only, never its value (values may be UUIDs or large text). Join facts with ` · `. Empty walk → `""`.

### `archived`

The lane it left: `from_lane` resolved to a name (or `a lane` if the id is present but unknown). No id → `""`.

### `restored`

The lane it returned to: `to_lane`, same rule as archived.

### `commented`

`payload.preview` when it is a non-empty string (issue-page spec: first 80 characters of the comment). Do not repeat `author` or `at`. Missing preview → `""`.

### Unknown `kind`

Facts `""`. Clock, kind, and actor still render.

---

## Architecture

Two units. No schema change. Writes stay as they are.

| Path | Role |
|---|---|
| `src/lib/card-history.ts` | Pure formatter. React-free. |
| `src/lib/card-history.test.ts` | bun tests for the formatter. |
| `src/components/board/card-history.tsx` | Paints the list. `"use client"` only so the clock can use the browser zone. |
| `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx` | Builds a lanes list and passes events + lanes in. Stops rendering JSON. |
| `docs/card-detail.md` | History section added so the chrome doc matches the page. |

The formatter takes an event (`id`, `kind`, `actor`, `payload`, `at`) plus the board’s lanes (`id`, `key`, `name`) and optional `{ timeZone, now }`. It returns `{ clock, kind, stat, actor, facts }`.

Lane lookup: match `id`, then `key`. Miss with a non-empty identifier → `a lane`. Empty identifier → no lane fact.

Tag ids in an `edited` payload stay the word `tags`. History does not load a tag catalog.

Invalid dates render `—`. A missing payload still shows clock, kind, and actor.

---

## Testing

bun tests on the formatter, with a fixed `timeZone: 'UTC'` and a fixed `now`:

- actor: email local-part, `etl`, blank → `someone`
- clock: `28 Aug 02:28`; year included when not this year; invalid → `—`
- `moved` names, unknown ids → `a lane`, rank omitted
- `imported` basename, hash omitted
- `created` lane key → name
- `edited` field list, `body`, `tags`, unknown keys as names only
- `archived` / `restored` lane names
- `commented` preview
- unknown kind: empty facts, `stat--muted`
- non-object payload: empty facts

e2e: keep `getByRole('heading', { name: /^History$/i })`. Add that the history list’s text does not contain `"from_lane"` or `"hash"` (the old JSON keys). Do not assert on `{` — a comment preview can contain one.

---

## Out of scope

Changing what is written to `card_events`. Pagination. Kind filters. JSON disclosure. Day grouping. Relative time. Resolving tag names. New pens, radii, or tokens. Load-more.

---

## Implementation note

`created` is written by ETL even though the original schema comment listed only `imported` among machine kinds. Format it. `commented` is specified on the issue-page design; format it even if that write is not on `master` yet, so History does not regress into a dump when those rows appear.
