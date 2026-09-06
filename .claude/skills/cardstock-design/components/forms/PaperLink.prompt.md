Use `PaperLink` for navigation and for in-place actions written as words rather than keys (Archive, Restore, Clear filters, Open project →).

```jsx
<PaperLink href="/p/demo">Open project →</PaperLink>
<PaperLink as="button" onClick={archive}>Archive</PaperLink>
<PaperLink as="button" danger onClick={remove}>Remove</PaperLink>
```

Board view links (Epic Cockpit, Calendar, Timeline, Manage) are plain `PaperLink`s at 12.5px sitting in a row under the title.
