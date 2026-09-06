Use `ColorPicker` wherever a card's or a lane's tint is chosen — it opens from the palette glyph on a card's rail, and sits inline in lane settings.

```jsx
<ColorPicker value={tint} onChange={setTint} />
```

The tint is frontmatter-owned paper, not a pen: it says nothing about priority or state. Nine tints (rose, orange, amber, green, cyan, blue, indigo, violet, pink) and null for neutral stock.
