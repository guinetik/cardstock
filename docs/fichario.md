# The fichário — why it is called cardstock

Every product has a fable, the story it tells itself about what it is. This is
cardstock's. It decides more than the name: it is why the markdown lives in
git and the board does not, why a card can leave a board and survive, and why
the design system draws a project as a folder with tabs.

## The twenty-subject notebook

At school you were supposed to own a twenty-subject notebook: one fat spiral
with a divider per class, every subject bound into the same spine. It never
made sense. If you were not taking chemistry that day, why were you carrying
the chemistry notes? You carried them because the binding said so. The
notebook decided what came with you, not the day.

Jira and Trello are the twenty-subject notebook. Everything the team has ever
thought is bound into one place, and you carry all of it to every meeting
whether the meeting needs it or not. The pages belong to the binding. Take a
page out and it stops being a page.

## The fichário

The fix, at home, was a *fichário*: a binder with a cardstock cover, rings
instead of a spine, and loose sheets. The sheets lived in folders at home, one
per subject. Every morning you clipped in the ones you needed for the day and
left the rest where they were. Chemistry stayed home on the days that were not
chemistry days.

The sheet is the unit. The binder is just what you carry it in.

## The connection

| At school | In cardstock |
|---|---|
| A loose sheet | A card: one markdown file, `<id>.md` |
| The folders at home, one per subject | The tracker in git — the **stock** of cards, kept by subject (epic, area), whether or not any board is open |
| The fichário with the cardstock cover | The app — the durable thing that holds whatever you clip in today |
| A folder per subject | A project (`.folder`, one per row on the projects page) |
| Divider tabs | Lanes and boards (`.folder-tab`, `.contents-tab`) |
| Clipping in today's sheets | A board view: a filter, a collapsed lane, an audience default, what you chose to carry |
| Unclipping a sheet | Archive with attribution — the sheet goes back in the folder, it is not thrown away |
| The notes on the sheet | The body — written by whoever did the work, people or agents |
| The margin marks | Priority, effort, target, lane, rank — the **decisions**, written in pen |

The board is the day's clip-in. The wiki is the folder at home. Neither is the
other's copy: the folders hold every sheet there is, the binder holds the ones
that matter right now, and a sheet is the same sheet in both places.

## What the fable decides

- **The sheet has no loyalty to the binder.** A card is a file first. It is
  imported into a board, it can be exported back out, and if the app is turned
  off tomorrow the tracker is still complete. Cards are not rows that happen to
  be exportable; they are files that happen to be shown.
- **Markdown owns the narrative, the app owns the margin.** What is written on
  the sheet — title, status, body, dates, relations — belongs to the folder.
  What is written in the margin while sorting the day's sheets — lane, rank,
  priority, effort, target, archive — belongs to the binder. The ETL moves
  sheets in; the export writes the margin back. `etl/mirror-board-state.ts`
  says it in one line: *this moves decisions, not content.*
- **Per-person carry is not shared state.** Which lanes you collapse, whether
  you hide `internal`, your sort in the inbox: that is what *you* clipped in
  this morning. It lives on your machine and never changes what is in the
  folder. Two people can carry different days from the same stock.
- **Agents fill the sheets.** In the notebook the pages were empty because
  writing was the expensive part. Here the agent that did the work writes the
  sheet — symptom, fix, evidence — so a card arrives on the board already
  full. That is why a lane like Gate 1 can be handed to someone as *"a recipe
  to QA"* without anyone writing a handoff.
- **Nothing is round and nothing is glass.** Cardstock is paper. The design
  system (`docs/paper.md`) is the fichário drawn literally: stock, ink,
  ruled lines, highlighter for the reader's own marks, projects as folders
  with tabs along the edge and a typed briefing sheet inside, the inbox as a drawer of slips not yet
  filed.

## Where it shows up

- `docs/paper.md` — *The folder*, *Lanes*: the visual vocabulary.
- `README.md` — *Markdown owns the narrative, the app owns the board.*
- `src/lib/import/plan.ts`, `src/lib/frontmatter/write.ts` — sheets in, sheets out.
- `etl/mirror-board-state.ts` — moving decisions between two binders.
- `docs/specs/2026-08-26-cardstock-design.md` — the ownership table and the
  decisions taken.
- `docs/superpowers/specs/2026-08-29-board-import-export-design.md`

## Differentiators the fable points at

Anything that is only true of a sheet, and never of a row, is ours to build.
Anything that is a better twenty-subject notebook is not.

1. **Agents as members.** An actor on a card that is not a person — in the
   history, on the face, in who moved it to Gate 1.
2. **The card as the recipe.** The card page is a handoff artifact: symptom,
   fix, evidence, verdict, with comments as the ledger.
3. **Sync is not a person.** A card that knows it disagrees with its file, a
   board that pulls on push, an export that runs itself — so the folder at
   home is never behind the binder.
4. **Dispatch from the binder.** *"Work on 192"* as an action on the card, not
   a message typed somewhere else.
