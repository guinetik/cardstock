Use `PaperButton` for any action in a cardstock surface; the filled `ink` variant is the primary action and there is no coloured primary button in this brand.

```jsx
<PaperButton size="sm">Add lane</PaperButton>
<PaperButton size="sm" variant="outline">Export CSV</PaperButton>
<PaperButton variant="danger">Delete project</PaperButton>
```

Variants: `ink` (filled ink, default), `outline` (hairline edge on the desk), `ghost` (no edge until hover), `danger` (red pen, never filled). Sizes: `md` (1.5rem inline padding, 14px/600 — the page-scale ask) and `sm` (28px tall, 12.5px/500 — letterheads and toolbars).

`BinderTool` is the square ink key used on a binder foot; pass `pen` for the named red-pen variant.

```jsx
<BinderTool title="Manage"><Icon name="settings" /></BinderTool>
<BinderTool pen as="a" href="#"><Icon name="gauge" />Epic Cockpit</BinderTool>
```
