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
[ 28 Aug 02:28 ]  [ MOVED ]  Joao moved this from Now to Next
[ 28 Aug 02:28 ]  [ EDITED ]  Joao set priority to P1
```

No JSON on the row. No disclosure. The sentence is the record. Unknown or unmapped events still get clock, kind, and actor — never a dump.

No behaviour change to writes, ETL, auth, or the 50-event cap. Comments stay comments (`body_md`); History stays `card_events`.

---

## Decisions taken

1. **Ledger line, not a narrative sentence.** Kind is a `.stat`. Facts are the rest of the row. No “this card was”.
2. **Payload is gone from the UI.** The database still stores it. The page does not render it.
3. **Clock on every row.** Local time, `d MMM HH:mm` (`28 Aug 02:28`). Year only when the event’s local calendar year is not the viewer’s current year (`28 Aug 2025 02:28`). No seconds. No day grouping. No relative time.
4. **Lane names, not ids.** Resolve `from_lane` / `to_lane` / `lane` through the board’s lanes (id or key → `name`). Unknown → `a lane`.
5. **Actor is a name in the sentence.** `joao@staffeto.com` → `Joao`. `etl` stays `etl`. Missing or blank → `someone`. Do not invent display names or diacritics.
6. **Existing pens only.** No new `.stat` variants, no new theme tokens, no nested card inside the page sheet.
7. **The body is a clause, not a dump.** Kind is the scan mark; the rest must read as something that happened (`Joao set priority to P1`), never `priority P1`.

---

## The line

Three columns, baseline-aligned, `text-xs`. No nested `.paper-card` / `.paper-lane`.

| Column | Type | Content |
|---|---|---|
| Clock | IBM Plex Mono, muted, tabular | `<time dateTime={iso}>` with the formatted stamp. `suppressHydrationWarning` on that node so SSR and the browser zone do not fight. Invalid `at` → `—`. |
| Kind | `.stat` + the modifier below | The verb as stored, already uppercase in `.stat`. |
| Body | actor then a verb clause | One sentence in Plex Sans, ink. `Joao set priority to P1`. Not muted mono. |

Empty list: a muted paragraph `Nothing recorded.` Heading stays an `h2` whose accessible name is `History` (e2e keys off it). Cap stays 50, newest first, as the page already queries.

### Kind pens

| `kind` | class |
|---|---|
| `moved`, `restored`, `commented` | `stat--info` |
| `created` | `stat--success` |
| `imported`, `edited`, `archived`, anything else | `stat--muted` |

### Actor

- If `actor` contains `@`, take the substring before the first `@`, trimmed, then capitalise the first letter (`joao@staffeto.com` → `Joao`). Empty local-part → `someone`.
- Otherwise use the trimmed string (`etl`).
- Null, undefined, or whitespace → `someone`.

### Clock

`Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })` assembled from `formatToParts` so the stamp is always `{day} {month}[ {year}] {hour}:{minute}` with no comma. `timeZone` is injected in tests; the UI omits it (browser local). “This year” is the calendar year in that same zone.

---

## Facts

The formatter never stringifies `payload`. It returns a **verb clause** the UI prefixes with the actor (`Joao set priority to P1`), or `""` when there is nothing to say.

Treat `payload` that is not a plain object as empty.

### `moved`

`from_lane` and `to_lane` are lane ids.

- both resolved: `moved this from Now to Next`
- only to: `moved this to Next`
- only from: `moved this from Now`
- neither: `""`

Do not show `rank`.

### `imported`

- `source`: `imported` plus last path segment (`foo/bar/156.md` and `foo\\bar\\156.md` → `imported 156.md`). If `source` is missing or not a string, `""`.
- Do not show `hash`, `status`, or `lane`.

### `created`

Landing lane from `payload.lane` (ETL writes the lane **key**). Resolve key → name, else the key if it is a non-empty string. With a lane: `created this in Unsorted`. Without: `created this`. Do not show `hash` or `source`.

### `edited`

Walk a fixed field order, then any other own keys alphabetically. Each key is a clause. Join with `and` for two items, Oxford comma for three or more.

| payload key | clause |
|---|---|
| `priority` | `set priority to P1` / `P2` / `P3` when the value is 1, 2, or 3; otherwise `changed priority` |
| `effort` | `set effort to L` / `M` / `H` when the value is that letter; otherwise `changed effort` |
| `target_date` | `set the target date to {value}` when it is a non-empty string; otherwise `changed the target date` |
| `target_label` | `set the target to {value}` when it is a non-empty string; otherwise `changed the target label` |
| `audience` | `marked this internal` / `marked this for everyone`; otherwise `changed audience` |
| `title` | `renamed it` |
| `summary` | `rewrote the summary` |
| `tags` | `changed the tags` |
| `body` | `edited the write-up` |

Any other key: `changed {key}` (never the value). Empty walk → `""`.

### `archived`

`archived this from Now` when `from_lane` resolves (or `a lane` if the id is present but unknown). No id → `archived this`.

### `restored`

`restored this to Next`, same lane rule as archived. No id → `restored this`.

### `commented`

`commented: {preview}` when `payload.preview` is a non-empty string. Do not repeat `author` or `at`. Missing preview → `""`.

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

- actor: email local-part capitalised (`Joao`), `etl`, blank → `someone`
- clock: `28 Aug 02:28`; year included when not this year; invalid → `—`
- `moved` clauses, unknown ids → `a lane`, rank omitted
- `imported` `imported 156.md`, hash omitted
- `created` `created this in Unsorted`
- `edited` verb list, `body` → `edited the write-up`, unknown keys `changed {key}`
- `archived` / `restored` clauses with lane names
- `commented` `commented: {preview}`
- unknown kind: empty facts, `stat--muted`
- non-object payload: empty facts

e2e: keep `getByRole('heading', { name: /^History$/i })`. Add that the history list’s text does not contain `"from_lane"` or `"hash"` (the old JSON keys). Do not assert on `{` — a comment preview can contain one.

---

## Out of scope

Changing what is written to `card_events`. Pagination. Kind filters. JSON disclosure. Day grouping. Relative time. Resolving tag names. New pens, radii, or tokens. Load-more.

---

## Implementation note

`created` is written by ETL even though the original schema comment listed only `imported` among machine kinds. Format it. `commented` is specified on the issue-page design; format it even if that write is not on `master` yet, so History does not regress into a dump when those rows appear.
