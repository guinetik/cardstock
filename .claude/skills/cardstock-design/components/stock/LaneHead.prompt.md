The divider tab at the top of a lane.

```jsx
<LaneHead name="Needs input" kind="waiting" count="2/5" sla={5} tools={<button className="lane-tool"><Icon name="plus" /></button>} />
```

The rule under the name is the whole point: 2px ink for `work`, a hairline for the quiet ones (`inbox`, `built`, `done`, `archive`), the amber pen for `waiting`. The name is 20px uppercase at 0.06em — caps tracking tightens as size grows or a long name like "Nice-to-have" outruns a 280px column.
