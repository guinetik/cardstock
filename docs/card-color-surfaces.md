# Card color surfaces

Board cards, the create sheet, and the issue editor share `CardColorPicker`. The tint class is applied only on `CardItem`’s `<article>` via `parseCardColor` and `cardColorModifier`. Unknown stored values render as neutral.

## Board card

`CardColorPicker` is a `fieldset` of native `button`s with `aria-pressed`. Every circle has a thick white rim and drop shadow. Neutral is a 1.5rem circle of `--surface-card` crossed by a solid `--pen-red` diagonal (`::after`); its accessible name is exactly `No color`. Tint swatches use `--surface-card-*` tokens. Overlay ghosts keep the background tint and omit the picker.

## Create sheet

The filing sidebar includes a Color row. Submit sends `color` on `CreateCardInput`. `board-view` prepends `result.card`, which already includes `color` from the create action select.

## Detail editor

`CardEditor` saves color through `updateCard` while `pending` disables the picker.
