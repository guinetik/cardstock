Use `Folder` for a project on the projects page, and `Folder section` for each chapter of a project page (boards, people, concepts, settings).

```jsx
<ul className="folders">
  <Folder name="Demo" href="/p/demo" aside={<><Stamp>13 cards<br/>filed</Stamp><PaperLink href="/p/demo">Open project →</PaperLink></>}>
    <p className="folder-blurb">A project is a collection of boards.</p>
    <ul className="binders"><Binder name="Product backlog" cards={13} /></ul>
  </Folder>
</ul>
```

The tab names the project and the binders name the boards — nothing is written twice. A folder's margin carries at most one `Stamp`; it is the only tilted thing on the page besides a card in hand.
