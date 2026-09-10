# Card stencils

A stencil defines a recurring kind of work for one board. Choose it from a
lane's add-card menu to open an editable card with its title, summary,
description, checklist, area, effort, and tags filled in. The card stays in the
chosen lane; epic, priority, assignee, and dates are decided for each card.

## Authoring

Open the board's Configuration page and find **stencils**, below **card
template**. Owners and project admins can add a named stencil, edit it, or
delete it. **Duplicate** copies all fields, checklist steps, and tags into an
independent stencil on the same board. Copies receive names such as
"Integration (copy)" and "Integration (copy 2)"; use **Edit** to rename or adapt
them. Names are unique within a board and listed alphabetically. Each row
shows its checklist step count and, when present, tag count.

The editor has a writing column, filing fields, and tag buttons. Add checklist
steps with **Add step**, edit their labels, and use the arrow buttons to reorder
them. Press **Enter** in a filled step to insert and focus the next step;
an empty step keeps focus without submitting the stencil. **Save stencil**
saves the form. Steps always start unchecked. An empty stencil offers **Start from the
board's card template** to copy the board's section skeleton into the editor.

When importing a template, checkbox lines such as `[ ] T1` gain the missing
list bullet, and checked steps become unchecked. The dialog shows a notice
when it corrects the imported checklist. Empty labels, nested steps, or notes
inside the checklist show an inline error; the draft is preserved so the
author can continue editing. The saved board template is unchanged.

The board card template remains a separate setting: it supplies the body for
the **Blank card** path. Creating or editing a stencil does not modify that
setting. Boards without stencils open the blank-card dialog directly.

## Storage and permissions

`card_stencils` stores board-scoped fields, with tags linked through
`card_stencil_tags`. Deleting a tag removes its stencil links. Tags must belong
to the stencil's board. The checklist lives in `body_md` under `## Checklist`;
there is no separate stencil checklist table. The editor uses `parseChecklist`
and `composeChecklist` to preserve the surrounding body when updating steps.
The existing card creation flow converts the stamped Markdown into real
`card_checklist_items` rows.

Server actions check `canManage` and bind the board or stencil to the project
whose permission was checked. Database RLS enforces project membership; as
with other board configuration, manager-only access is enforced by the UI and
server actions rather than RLS.

Stamping is a copy. Cards keep no link to their source stencil, so later edits
or deletion never change existing cards. Stencils do not sync through the CLI;
stamped cards sync as ordinary cards. Packets, which stamp a set of stencils
together, are a later phase.

## Verification

- `src/lib/stencils.test.ts`: validation, checklist normalization, independent
  initial values, and exclusion of per-card fields.
- `supabase/tests/card_stencils.sql`: membership isolation, unique names,
  effort constraints, cross-board tags, and tag deletion cascades. Fixtures
  are rolled back.
- `e2e/card-stencils.spec.ts`: authoring and reordering, tags, duplicate names,
  stamping into real checklist rows, independence after stencil changes,
  blank-card behavior, and management permissions. Each test owns its fixtures.
