Use `EpicTome` for an epic in the Epic Cockpit. The outlook is written on the spine only — never as a filled badge across the tile.

```jsx
<EpicTome outlook="at-risk">
  <header style={{ borderBottom: "1px solid var(--border-hairline)", paddingBottom: "0.75rem" }}>
    <Eyebrow>Epic · Ana</Eyebrow>
    <h2 style={{ fontSize: "18px" }}>Onboarding</h2>
    <Stat tone="danger">At risk</Stat>
  </header>
</EpicTome>
```

Shelve tiles in a grid with at least 1rem of desk between them — the page block needs 6px of room past the cover at the bottom right, and tomes flush against each other read as one block.
