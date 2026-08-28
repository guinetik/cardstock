# Unit tests (`bun test`)

`bunfig.toml` sets `[test] root = "."` so discovery covers both `etl/*.test.ts` and `src/**/*.test.ts`. Playwright files under `e2e/` are excluded via `pathIgnorePatterns` (they are not Bun unit tests).

```sh
bun test
bun run check
bun run test:e2e   # needs local Supabase + `.env.local`; see playwright.config.ts
```

Work-lane e2e drags onto `lane.boundingBox().y + 120`. Empty lanes keep a droppable list of at least 160px (`lane-column.tsx`) and stretch with sibling columns. Board collision detection uses `pointerWithin` first so that hit lands on the lane, not the dragged card (`closestCorners`). Collapsed lanes persist on `members.prefs.laneViews` (`e2e/lane-view.spec.ts`); a leftover collapse hides cards, so that spec clears the pref. Issue body edit and comments: `e2e/issue-body.spec.ts`.
