Use `Icon` for every glyph. cardstock's icon set is Lucide at 2px stroke, and an icon is always the same ink as the text beside it — never a coloured badge of its own.

```jsx
<Icon name="pin" size={13} />
<span style={{ color: "var(--pen-red)" }}><Icon name="calendar-clock" size={13} /> overdue</span>
<button className="binder-tool"><Icon name="settings" size={14} /></button>
```

Sizes in use: **13** on card chrome (the rail, the age gauge, the epic label), **14** in toolbars and binder keys, **18** where a glyph stands alone.

The set is exactly the glyphs the app imports and no more: `arrow-left`, `arrow-right`, `book`, `calendar-clock`, `check`, `chevron-down`, `chevron-left`, `chevron-right`, `chevron-up`, `columns-3`, `download`, `ellipsis` (alias `more-horizontal`), `flag`, `gauge`, `grip-vertical`, `inbox`, `maximize-2`, `minus`, `moon`, `paperclip`, `palette`, `pencil`, `pin`, `pin-off`, `plus`, `rocket`, `settings`, `sun`, `trash-2`, `upload`, `x`. Need another? Take it from Lucide — never draw one.

The same glyphs are on disk at `assets/icons/<name>.svg` for consumers that want files rather than a component.
