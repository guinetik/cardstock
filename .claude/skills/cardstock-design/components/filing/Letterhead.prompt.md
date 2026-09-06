Use `Letterhead` at the top of any project, board or view page. Counts sit beside the title, view links under it, and the page's two ink keys in the margin.

```jsx
<Letterhead
  eyebrow={<a href="/p/demo">DEMO</a>}
  title="Product backlog"
  links={<><PaperLink href="#">Epic Cockpit</PaperLink><PaperLink href="#">Calendar</PaperLink><PaperLink href="#">Timeline</PaperLink></>}
  aside={<><PaperButton size="sm">Add lane</PaperButton><PaperButton size="sm" variant="outline">Export CSV</PaperButton></>}
/>
```

`Portrait` is always a square with a 1.5px strong edge — cardstock has no round avatars.
