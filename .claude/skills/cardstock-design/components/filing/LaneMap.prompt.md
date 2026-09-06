Use `LaneMap` inside a wide `Binder` to show a board at a glance — never as a substitute for the board itself.

```jsx
<Binder wide name="Product backlog" href="#" count="13 cards">
  <LaneMap lanes={[
    { name: "Unsorted", kind: "inbox", cells: [{ signal: "queued" }, { signal: "queued" }, {}] },
    { name: "Now", cells: [{ signal: "moving" }, { tint: "amber" }, { signal: "late" }], more: 4 },
    { name: "Done", kind: "done", cells: [{ signal: "delivered" }] },
  ]} />
</Binder>
```

Lane names live in the hover tip, not under the columns — the microcosm is a shape, not a table.
