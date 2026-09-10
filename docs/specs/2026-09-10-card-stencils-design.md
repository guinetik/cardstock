# Card stencils — design (2026-09-10)

A stencil is a named, board-scoped definition of one recurring kind of work. You
stamp a card from it and the card arrives with its title, summary, body, checklist
and tags already in place.

## The problem

From the 2026-09-09 call, two things said minutes apart.

Hap, on what a delivery card contains:

> On the subtasks, I believe for delivery, it's always going to be the same five
> steps. If we find that there's a sixth, we can add a sixth.

And the shape of Sanjay's week: every new client means one card per integration,
each assigned to that client's epic, each given the same checklist by hand —
credentialing, field mapping, development, testing, sign-off, go-live. The list
never changes. He retypes it once per integration, several integrations per client.

The checklist is not a property of the card. It is a property of the *kind of
work*. Nothing in the product says so, so it gets re-entered by hand every time.

Three consequences follow, and the third is the reason to build this:

1. **The cost is N×, not 1×.** The unit of repetition is a client's whole card
   set, not one card.
2. **The work types are a small, stable vocabulary.** "Integration", "New hire",
   "Employee update" — org process, not personal preference.
3. **Standard checklists are what make the checklist aggregate.** Today a card at
   3/5 and another at 3/5 are coincidence: different lists, different steps. When
   every delivery card is stamped from one stencil, 3/5 means the same position in
   the pipeline everywhere. Hap's progress bar stops counting checkboxes and starts
   reporting a pipeline stage that can be compared across integrations and rolled
   up per client.

Point 3 is the strategic one. Stencils are what turn the checklist from a per-card
note into data worth aggregating.

## What this is not

**Not a replacement for the board card template.** `boards.settings.card_template`
stays exactly as it is. It is a *structural floor* — every card on the board starts
with the section skeleton the markdown sync's validator demands. It is a constraint
that applies to all cards, not one option among several. This design does not
migrate it, read through it, or deprecate it.

**Not a "board template".** That name implies templating the board — lanes, gates,
columns. Out of scope and unasked for.

**Not a packet.** A collection of stencils that stamps a whole card set in one
action is Phase 2, specified separately. This document covers only the primitive.

## Vocabulary

The product's fable is a fichário — a binder of loose sheets — and `docs/paper.md`
runs on stock, ink, ruled lines, sheets, folders and drawers. The names follow it.

| Term | Meaning |
|---|---|
| **stencil** | One reusable definition of a kind of work. You stamp a card from it. |
| **packet** | Phase 2. A set of stencils stamped together, e.g. "new client onboarding". Real HR vocabulary — a "new hire packet". |

"Recipe" is deliberately avoided: Sanjay already uses it for the card itself
("a recipe for me to QA"), and it would collide.

## Data model

Two tables, board-scoped, on the same shelf as lanes, epics and tag groups — the
only scope where a tag reference is a real foreign key rather than a string match
that can silently fail.

```sql
create table public.card_stencils (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0), -- "Integration"
  title      text,                         -- default card title, prefilled
  summary    text,
  body_md    text not null default '',     -- includes the "## Checklist" section
  area       text,
  effort     text check (effort in ('L','M','H')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, name)
);

create table public.card_stencil_tags (
  stencil_id uuid not null references public.card_stencils(id) on delete cascade,
  tag_id     uuid not null references public.tags(id)           on delete cascade,
  primary key (stencil_id, tag_id)
);

-- updated_at is trigger-maintained, like members/projects/boards/cards/epics.
create trigger card_stencils_touch before update on public.card_stencils
  for each row execute function public.touch_updated_at();
```

`effort` mirrors the `cards` constraint exactly, so a stencil cannot hold a value a
card would reject.

Stencils are listed alphabetically by name. There is no `position` column and no
manual ordering; a board carries a handful of stencils and sorting by name costs
nothing. A column can be added later if that stops being true.

**RLS** mirrors `lanes` exactly — a single `for all` policy gated on
`is_project_member(board_project(board_id))`. Authorisation beyond membership
lives in the server actions, as it does today: `updateCardTemplate` resolves the
project and checks `currentAccess(project.id).canManage`. Stencil actions do the
same — including `updateCardTemplate`'s binding check that the target board (or
the stencil's board) belongs to the slug-resolved project, so a manager of one
project cannot reach another project's stencils by mixing identifiers. The
result: the people who can edit the card template are the people who can edit a
stencil.

Owned tradeoff: because `canManage` is action-level only, a plain project member
can write stencils directly through the API, bypassing the actions. That is the
same posture as `lanes` and the rest of board configuration, and is accepted —
RLS draws the membership boundary; manager-only is a UI/action convention.

### What a stencil does not store

| Field | Why not |
|---|---|
| `epic` | The one field that varies per card. Sanjay picks the client epic every time; everything else repeats. |
| `lane` | The create dialog already knows it from where the card is being added. |
| `priority` | Priority is a triage decision relative to the rest of the board at a moment in time, not a property of a kind of work. A stencil stamping `priority: 1` on every Integration card would systematically lie, re-creating the problem card #9 was filed about: a priority field full of values nobody meant, so the filter returns noise. |
| assignee, dates | Per-card facts with no stable value across a work type. |

### The checklist lives in `body_md`

There is no stencil-side checklist table. `createCard` already runs
`parseChecklist(bodyMarkdown || cardTemplate(settings))`, so a stamped body yields
real `card_checklist_items` rows through the path that already exists. One markdown
format, one source of truth, and the CLI keeps reading what it already reads.

Deleting a board tag cascades it out of every stencil that referenced it. This is
the correct behaviour and the reason tags are a table rather than a jsonb array.

### Sync

Stencils are board configuration, not sheets. They never sync, and the CLI needs no
changes. A card stamped from a stencil is an ordinary card whose markdown carries
its own body and checklist.

## Stamping a card

The stencil is chosen **before** the create dialog opens.

```
lane "+"
├─ board has no stencils  → blank dialog, exactly as today
└─ board has stencils     → menu
                             ├─ Blank card
                             ├─ Integration
                             ├─ New hire
                             └─ Employee update
                                    ↓
                          dialog opens pre-filled via initialValues
```

The alternative — a stencil dropdown inside the dialog — must answer "you have
already typed three paragraphs, do I overwrite them?" Every answer is bad: destroy
work silently, or put a confirmation on a routine action. Choosing first makes the
question impossible, and it matches how the work actually happens: you know it is
an Integration card before you start typing.

`CardCreateDialog` already accepts
`initialValues?: Partial<Omit<CreateCardInput, "boardId" | "laneId">>`
(`card-create-dialog.tsx:60`), and card cloning already uses it. A stencil is that
same object built from a row instead of from a card. The mechanism exists.

| From the stencil | Behaviour |
|---|---|
| `title`, `summary` | Prefilled, fully editable |
| `body_md` | Becomes the body; its `## Checklist` becomes checklist items on save |
| tags | Pre-selected in the tag row |
| `area`, `effort` | Prefilled in the sidebar |
| — | epic, lane, assignee and dates stay empty |

**A stencil is a starting point, never a lock.** Every field stays editable, and
the card stores no reference back to the stencil. Editing a stencil later changes
nothing about cards already stamped — the same promise the card template makes
today: *existing cards are never touched*.

`createCard` needs no change. It receives an ordinary `CreateCardInput`; the body
it parses a checklist out of merely happens to have come from a stencil.
`cardTemplate(settings)` remains the fallback for the blank path, as it is now.

## Authoring

A new `ProjectSection` titled **stencils** on `/p/<project>/b/<board>/manage`,
directly under the existing "card template" section. The adjacency is deliberate:
the floor, then the shapes stamped on it.

The list follows the `taxonomy-editor.tsx` idiom — inline rows, per-row server
actions, an add row at the end:

```
stencils
├─ Integration        6 steps · 2 tags        edit · delete
├─ New hire           4 steps · 1 tag         edit · delete
├─ Employee update    4 steps                 edit · delete
└─ + Add stencil
```

Rows carry edit and delete only — there is no drag handle, because there is no
`position` to write. "Steps" counts the stencil's checklist items.

**Editing one opens a dialog shaped like the card create dialog** — same writing
column, same sidebar, same tag row. Not for code reuse but for affordance: what is
being edited *is* a card, so it should look like one. This is a new pattern for the
manage page, where taxonomy and gates edit inline. The mapping is judged to earn
the inconsistency.

**Checklist authoring is a list, not raw markdown**, while storage stays markdown:

```
load   body_md ──parseChecklist──▶  [ ] Credentialing
                                    [ ] Field mapping
                                    [ ] Testing
save   items ──writeChecklist──▶   body_md
```

`writeChecklist` edits only the reserved section and preserves the file's exact
bytes when the meaning is unchanged, so the rest of the body survives editing.

`card-checklist.tsx` is built for a live card — completion state, revisions,
optimistic writes. A stencil's items are always unchecked and have no revision, so
expect a small extraction of the row and reorder UI rather than direct reuse. The
implementation plan should size that honestly rather than assume it.

A new stencil offers **"start from the board's card template"**, so an author
inherits the section skeleton the board already demands and adds the checklist,
instead of retyping it.

Permissions: `canManage`, with the same "Only an owner or project admin can change
this" note the card template editor carries.

## Testing

| Layer | What proves it |
|---|---|
| `supabase/tests/card_stencils.sql` | RLS: a project member reads and writes; a non-member can do neither; `unique (board_id, name)` and the `effort` check reject bad rows; deleting a tag cascades its stencil row away |
| `e2e/card-stencils.spec.ts` — authoring | Create a stencil on manage, add a three-step checklist in the dialog, save → the row reads `3 steps` and `body_md` holds the items |
| `e2e/card-stencils.spec.ts` — stamping | Stamp a card from a stencil → assert three `card_checklist_items` rows exist on the new card |

There are no server-action unit tests: the repo has no harness for them, and the
validation worth unit-testing lives in `src/lib/stencils.ts`. The actions are
covered by the authoring e2e test plus a manual pass for delete and tags.

The end-to-end case is the feature. If stamping a stencil does not produce real
checklist rows, nothing else matters.

## Dependency

This design rests on `parseChecklist`, `writeChecklist` and `card_checklist_items`,
all delivered by the checklist feature. **Work should not start until that feature
is committed and settled.** The claim that "the checklist lives in `body_md`" is
true only because that work made it true; if its markdown contract shifts, the data
model shifts with it.

## Out of scope

- **Packets** — Phase 2, specified separately.
- **Applying a stencil to an existing card** — a merge problem with no good answer
  for a half-checked checklist.
- **A stencil reference stored on the card** — stamping is a copy, not a link.
- **Project-scoped or personal stencils** — tags and epics are board-scoped, so a
  wider scope degrades tag references to string matching that fails silently. If
  sharing across boards becomes real, add "copy stencil to board" instead of a
  second scope.
- **Title placeholders** such as `{client}` — these belong to packets, where one
  stencil stamps N cards that need distinct names.
