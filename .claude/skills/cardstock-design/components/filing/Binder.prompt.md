Use `Binder` for a board inside a `Folder`. Narrow binders shelve side by side on the projects page; `wide` binders run full width on a project page and carry a `LaneMap`.

```jsx
<ul className="binders">
  <Binder name="Product backlog" href="/p/demo/b/backlog" count="13 cards" stacked
    tools={<><BinderTool title="Manage"><Icon name="settings" /></BinderTool>
             <BinderTool pen as="a" href="#"><Icon name="gauge" />Epic Cockpit</BinderTool></>} />
</ul>
```

Never put the board name in both the cover and a link on the foot — the cover *is* the way in.
