One kanban column. A lane is a column of its own stock, so an empty lane still reads as a place to put something.

```jsx
<PaperLane kind="work" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.5rem" }}>
  <LaneHead name="Now" kind="work" count={3} />
  {cards}
</PaperLane>
```

`kind="inbox"` renders the **drawer** — sunken well stock with an inset edge, whose cards should be `PaperCard variant="flat"`. An in-tray is emptied, not read. `kind="waiting"` gives `LaneHead` the amber rule and takes an `sla`. `collapsed` turns the lane into a `lane-spine`: its name turned on its side, count at the foot, still a drop target.

Both states are the same `<section>` so the width animates — swapping elements makes the board snap.
