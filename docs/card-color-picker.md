# Card color picker

`CardColorPicker` is the shared control for board-card tints.

## Swatch rim

Every tint and none circle uses a thick white rim (`border: 2px solid white`)
and a soft drop shadow (`box-shadow: 0 1px 4px rgb(0 0 0 / 0.32)`). This
replaces the gray 1px border and inset hairline. That rim is the stroke.

## Neutral

The first choice is the same 1.5rem circle as every tint. It uses paper stock
(`--surface-card`) and a solid `--pen-red` diagonal slash via `::after`
(`height: 0.125rem`, `border-radius: 999px`), clipped to the circle with
`overflow: hidden`. The accessible name is exactly **No color** (`aria-label`
plus `.sr-only`). Native `button` + `aria-pressed` and the wrapping `fieldset`
stay in place.

## Palette

Nine named opaque surfaces (`rose` … `pink`) are declared on `--surface-card-*`
in both `paper` and `paper-night`. Card foreground ink is unchanged. Clearing
the choice sets `color` to `null` and restores `--surface-card`.
