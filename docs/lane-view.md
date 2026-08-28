# Lane view persistence

Per-board lane collapse / maximize, remembered on the member like inbox sort.

Theme uses `localStorage`. Board UI prefs (`inboxSort`, `showInternal`, `laneViews`) live on `members.prefs` so the first paint matches the server and a refresh does not flash expanded lanes.

## Shape

```
prefs.laneViews = {
  [boardId]: { [laneId]: "min" | "max" }
}
```

Default width is omitted. Restoring a lane deletes its key; restoring every lane on a board deletes the board key. Spring-loaded drag collapse is overlay-only and is not stored.

Helpers live in `src/lib/lane-view.ts`. The board page seeds `BoardView` from `me.prefs.laneViews[board.id]`; minimize / maximize / restore call `savePrefs({ laneViews })`.
