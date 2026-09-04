# Unit tests (`bun test`)

`bunfig.toml` sets `[test] root = "."` so discovery covers both `etl/*.test.ts` and `src/**/*.test.ts`. Playwright files under `e2e/` are excluded via `pathIgnorePatterns` (they are not Bun unit tests).

```sh
bun test
bun run check
bun run test:e2e   # needs local Supabase + `.env.local`; see playwright.config.ts
```

Work-lane e2e drags onto `lane.boundingBox().y + 120`. A lane's droppable is its whole `<section>` — the same node `useSortable` makes the lane draggable from (`lane-column.tsx`, `SortableLane`) — so the header is a drop target too; the card list's 160px `min-h` is layout only now, keeping an empty lane tall enough to aim at. Board collision detection uses `pointerWithin` first so that hit lands on the lane, not the dragged card (`closestCorners`). While a *lane* is in hand it first drops every card droppable from the running, so `over` is always a lane and the lanes part to make room; the card path is untouched. Lanes are dragged by their grip only (`[data-testid="lane-drag-handle"]`) — the header's other buttons must stay clicks, so lane drags in e2e press the grip and move twice: a short move to clear the 6px activation distance, then the travel. Collapsed lanes persist on `members.prefs.laneViews` (`e2e/lane-view.spec.ts`); a leftover collapse hides cards, so that spec clears the pref. Issue body edit and comments: `e2e/issue-body.spec.ts`. Project members and invites: `e2e/management.spec.ts`. Board concepts and gates: `e2e/board-manage.spec.ts` (the same editors also live on the project page: `e2e/taxonomy.spec.ts`, `e2e/gates.spec.ts`).
