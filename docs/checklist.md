# Checklist

Cards have a flat ordered checklist, managed in the Checklist section of the full
card page or modal. Add, rename, check, delete, and reorder there. Drag items or
use the up/down buttons. Completion never changes the card's status or lane.

Checklist items belong to one card and are not linked cards. `## Subtasks` is
not interpreted as a checklist; that name is reserved for future linked-card work.

The Markdown representation is:

```markdown
## Checklist
- [x] Define the interface
- [ ] Implement the endpoint
```

Import extracts the section into `card_checklist_items` and removes it from `body_md`.
Only a document-level level-two Checklist heading is reserved (case insensitive).
The section ends at the next level-one or level-two heading. Fenced and quoted
examples are ignored. Use a flat list with non-empty single-line labels; nested
lists, notes within the section, and duplicate sections are validation errors.
Duplicate labels are allowed. Checkmarks accept `x` or `X`, and unordered list
markers accept `-`, `*`, or `+`.

Web import preserves the existing list if the section is absent. A present
section replaces the list, including its order and completion state. An empty
section clears it. The body editor applies these same rules and shows a notice
when a pasted section will replace an existing list. Cloning copies labels and
order with fresh identities and unchecked states.

Exports insert the current checklist into the Markdown, retaining its original
position when the body is otherwise unchanged. New sections go before Comments,
or at the end. Empty managed lists keep an explicit header so clearing survives
web re-import. No item IDs are written into Markdown. Unchanged source sections
retain their bytes; edited lists use canonical `- [ ]` / `- [x]` lines.

CLI sync protocol 5 compares the checklist independently of the body. Body edits
can merge with checklist edits. Concurrent checklist edits conflict as a whole;
resolve with `--ours <id>:checklist` or `--theirs <id>:checklist`. A removed section
against a baseline clears the list and becomes an explicit empty section. Without
a baseline, omission downloads the existing list. Legacy ETL protects app-edited
checklist items using `checklist_edited_at`, independently of body ownership.

Cockpit backgrounds show task status. White inner borders separate checklist segments.
Each segment has a minimum width; longer checklists widen the task and push later
tasks along or onto the next row. Oversized tasks scroll horizontally within the map. The green internal segments show completed
checklist items in list order. Hover or keyboard focus gives exact completed/total
counts. Cards without checklist items keep their solid status treatment. Epic effort,
delivery counts, forecasts, and burndown calculations do not use checklist counts.

## Deployment

Apply `20260919000000_card_checklist.sql`, then run the backfill before enabling
the updated website. Build/distribute the updated CLI together with the server;
protocol 4 clients receive an upgrade message when attempting writes.

```powershell
bun run --env-file=.env.local etl/backfill-checklist.ts
bun run --env-file=.env.local etl/backfill-checklist.ts --apply
bun run build:cli
```

Backfill previews by default. It reads current database bodies, preserves edit
ownership, checks revisions, and skips and reports malformed or ambiguous cards.
It is safe to rerun; it never sources content from old uploaded files.

Writes use a transient `cards.checklist_input` envelope consumed by a trigger in
the parent transaction. The relational rows are the sole stored checklist.
Members read children under parent-card RLS; child writes go through the parent
so validation, revision checks, history, and source projections stay consistent.
