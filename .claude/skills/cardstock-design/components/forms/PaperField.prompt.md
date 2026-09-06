Use `PaperField` for every text, date and select control, and wrap any cluster of small controls in a `Fieldset` so the abbreviations are labelled.

```jsx
<PaperField type="search" placeholder="Search #id or title" className="lane-column-width" />
<Fieldset legend="Priority">
  <Sq on pen="red">P1</Sq>
  <Sq>P2</Sq>
  <Sq>P3</Sq>
</Fieldset>
<PaperField as="select" aria-label="Unsorted order"><option>Oldest first</option></PaperField>
```

`FieldLabel` is the 9.5px uppercase label in the card form's 3.25rem margin gutter — use it for STATUS, WAITING, DATES, TAGS, NOTE rows, never as a general-purpose caption (that is `Eyebrow`).
