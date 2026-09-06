The base surface of the whole product: one sheet of stock, 2px corners, a contact shadow, and a lift towards the pointer.

```jsx
<PaperCard as="article" style={{ padding: "0.625rem" }}>
  <h3>Invoice PDF shows the wrong currency</h3>
</PaperCard>
```

Variants: `resting` (default, lifts on hover), `flat` (inbox drawer slip — flush and hairline-separated), `static` (page-scale sheet, ignores the pointer), `still` (form sheet; focus inside a field must not lift it), `overlay` (in hand: deeper shadow, rotated -0.7deg).

`tint` paints one of the nine pastel card colours. `signal="forgotten" | "overdue"` adds the red or amber rule down the left edge. `pinned` holds the lift and the open peek after the pointer leaves.

Never round the corners past 2px and never make it translucent — a lane full of glass was the failure this system replaced.
