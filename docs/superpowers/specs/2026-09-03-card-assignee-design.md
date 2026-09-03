# Card assignee — one person per card, stated by the file

**Date:** 2026-09-03
**Status:** approved in conversation; implementation follows this document.
**Scope:** A single assignee on a card, drawn from the project roster, settable on the card page and in the create dialog, filterable on the board, and round-tripped through frontmatter as an email. One person per card, not many.

---

## The problem

People already exist. `members` is the sign-in allowlist, `project_members` is the roster for a folder with an `admin` / `member` role, invites write both in one RPC, and `/p/[project]` renders the roster as wide binders with a Gravatar apiece. That machinery is finished.

Cards know nothing about it. The nearest thing is `cards.raised_by` — free text, no foreign key, stamped once at creation from `display_name || email.split("@")[0]` and never edited again. It records who asked, not who is doing it. There is no way to hand a card to somebody, no way to see what is on your plate, and no way for a tracker file to say who owns the work.

---

## What we're building

A card carries **one** assignee, or nobody. The assignee is a person on the card's project. You set it from a select on the card page or in the create dialog, and you can narrow the board to one person's cards from the filter bar.

In the file, that assignment is an email:

```yaml
---
id: 42
title: Assignment field
status: wip
area: board
assignee: joao@gmail.com
raised_by: Sam
---
```

Out of scope: multiple assignees, watchers or subscribers, notifications of any kind, per-person workload in the cockpit, a portrait on the board card, and any reassignment triggered by removing somebody from a project.

---

## Decisions taken

1. **Exactly one person.** A nullable column on `cards`, not a `card_assignees` join table. "Who owns this" keeps having an answer, every surface renders one name rather than a stack, and filtering stays a scalar comparison. If many are ever needed, this column becomes the primary and a join table carries the rest — nothing here has to be undone.

2. **The file states an email.** `members.email` is already a `citext` unique key, so import resolves an assignee with one lookup and never guesses. Display names are mutable and non-unique — someone editing `/profile` would silently orphan every file naming them. Local-part handles collide across domains. Emails in files are noisier to read; that is the price of a stable key, and this is a private tracker.

3. **FK and text travel together**, exactly as `epic_id` / `epic` do. `assignee_id` is the live relation the app joins on; `assignee` is what the file says. `assignCardEpic` already writes both in one patch, and this follows it.

4. **An unknown email is not an error.** Import keeps the text and leaves the FK null. A file written by hand on a machine with no database, naming someone not yet invited, survives import → export unchanged. Dropping the value instead would make the database quietly authoritative over the file, which is backwards for a fichário.

5. **No database constraint tying the assignee to the roster.** Decision 4 requires import to write off-roster text. Roster validation therefore lives in the server action — the only path a person can take interactively.

6. **Removing somebody from a project changes no card.** They may come back, and the file remains truthful in the meantime. The select stops offering them; existing cards show the raw email marked as off-roster.

---

## Schema

`supabase/migrations/20260909000000_card_assignee.sql`:

```sql
alter table public.cards
  add column assignee_id uuid references public.members(id) on delete set null,
  add column assignee    citext;
create index cards_board_assignee on public.cards (board_id, assignee_id);
```

`on delete set null` covers the one destructive case — a member deleted from the allowlist entirely — and leaves the text behind so the file still reads.

**No RLS work.** `members_read` (migration `20260904000000_project_admin.sql`) already permits `shares_project_with(id)`, so a project member can read co-members and the board page can load its own roster. `cards_rw` already gates the write by project membership.

---

## Write path

`assignCard(cardId, memberId | null)` in `src/app/p/[project]/b/[board]/actions.ts`, modelled on `assignCardEpic`:

1. `currentMember()`, else `Not signed in.`
2. Validate `cardId` (and `memberId` when non-null) against the `UUID` pattern.
3. When `memberId` is non-null, confirm a `project_members` row joining that member to `card_project(cardId)`, and read the member's email. No row → `That person is not on this project.`
4. `update cards set assignee_id = …, assignee = <email or null>` — one patch, both columns.
5. Insert a `card_events` row: `kind: "edited"`, `actor: me.email`, the patch as payload.
6. `revalidatePath`.

Step 3 is the only enforcement of the roster rule, so the create-dialog path must go through this action rather than writing the columns itself.

---

## Round trip

The field is not done until all of these move together:

| File | Change |
|---|---|
| `docs/frontmatter.schema.json` | `assignee`: string \| null |
| `src/lib/frontmatter/schema.ts` | `assignee: z.string().nullable().optional()` |
| `src/lib/frontmatter/sheet.ts` | `CardSheet.assignee`; a `SHEET_KEYS` entry after `area` and before `raised_by`, which fixes its position in newly written files |
| `src/lib/import/plan.ts` | `set("assignee", …)` writing **both** `assignee` and `assignee_id` |
| `src/lib/types.ts`, `src/lib/import/types.ts` | `assignee_id` and `assignee` on the card types |
| `src/lib/board-data.ts:50`, `src/app/p/[project]/b/[board]/actions.ts:220`, `src/lib/import/board-state.ts:28` | the three card `select(…)` lists carry the columns |

**Import** resolves email → `member_id` from one email-keyed map loaded once per run, not a query per card. Comparison is case-insensitive, matching `citext`. Unresolved → text kept, FK null (decision 4).

**Export** writes `assignee_id`'s current email when the FK is set, otherwise the stored text. A card assigned through the UI and a card assigned by hand in a file therefore converge on the same file.

---

## Read surfaces

**Card page.** A native select in the labeled field grid beside Status, following `docs/card-detail.md` — `--surface-input`, `--color-ink`, 10px uppercase grey label. Options are the roster sorted by `display_name ?? email`, plus *Unassigned*. Saves through `assignCard`; `pending` disables it. When the stored text resolves to no member, it renders as a selected disabled option reading `joao@old.com · not on this project`, so editing another field never quietly erases it.

**Filter bar.** `Filters.assignee: string | null`, with `ASSIGNEE_FILTER_NONE = "__none__"` beside the existing `EPIC_FILTER_NONE`. `matches` compares `card.assignee_id`; the none case also treats a card with off-roster text as assigned, not unassigned. A chip row per member plus *unassigned*, the signed-in member first and labeled **Me**. The value lives in the URL like the other view controls. Touches `emptyFilters`, `isFiltering`, `matches`, and adds an assignee column to `toCsv`.

**Create dialog.** A select defaulting to *Unassigned* — not to you, because filing a card is not the same as taking it. `createCard` gains an optional `assigneeId` and routes it through the same validation.

**History.** `src/lib/card-history.ts` gains `assigned this to Joao` and `unassigned this`, capitalising the email local-part by the rule already there. Facts are verbs; never dump the payload.

**Loading.** `loadBoard` gains one roster query (`project_members` → `members`, filtered to the board's project) exposed as `BoardData.people`, feeding all three surfaces from a single round-trip.

---

## Testing

Unit:

- `filters.test.ts` — matching a member, `unassigned`, and a card whose text is off-roster (assigned, not unassigned).
- A frontmatter round-trip test proving an unknown email survives import → export byte-identical.
- An `import/plan` test asserting the null-FK fallback writes the text.
- A `sheet` test pinning `assignee`'s position in a newly written file.

E2E:

- Assign on the card page, reload, the name persists.
- Filter to a person, the lane shortens to their cards; *unassigned* is its complement.
- Create a card with an assignee, open it, the assignee is set.

---

## Known trade-off

Filtering by a person whose face never appears on a board card means the lane silently gets shorter with no per-card explanation, and answering "who owns this?" costs a click. The board-card portrait was deliberately left out of this scope; if it becomes annoying in use, the roster is already loaded in `BoardData.people` and adding a Gravatar to the card is a small, isolated follow-up.
