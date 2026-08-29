# Board card density

Board cards rest as **`#id`, title, epic, and the decisions already made** — the two pen squares for priority and effort, plus a status word when it is not `backlog`. The filter bar can restrict by that same word: a Status cluster lists whatever values this board actually has; nothing selected means every status. That is the bird's-eye scan. Unrated cards show nothing rather than empty slots. A selected `color` adds `card-color--{name}` on the `<article>` only (parsed with `parseCardColor`), tinting the paper; the drag overlay keeps the tint and omits the picker.

Hover (or keyboard focus-within) lifts the card out of the lane and opens `.card-peek`. The resting summary (`.card-rest`) collapses at the same moment and on the same clock, so nothing is on screen twice and the card never gets shorter mid-opening (an instant `display: none` used to drop the bottom edge ~25px for a few frames, which threw a pointer near the edge off the card and left hover flickering). The drag overlay stays compact so the ghost does not balloon.

## The back of the card

The peek is `.card-form`: a label column in the margin and values in the body, like the back of an index card someone has filled in. Every row is named, so nothing floats unexplained.

| Row | What it holds |
|---|---|
| Tags | Highlighter marks in their group's colour |
| Target | Two stacked fields — a real day, **or** a rough date in words when no day is agreed |
| Effort / Priority | One row, four columns matching the form gutter: Effort · L/M/H · Priority · P1–P3. The L square starts on the same value column as Tags and Target. |
| Color | No color plus nine named pastel swatches; paints the card background |
| Note | The card summary, clamped to three lines |

The two date fields were the confusing part of the old layout: they sat side by side with no labels, and nothing said one was a committed day and the other a phrase. They are now one **Target** row, stacked, and the second reads `or a rough date — end of Q3`.

## The rail

Opposite the card number, two icons stack in the corner and show with the peek: **pin** and **maximize**.

- **Pin** leaves the card open after the pointer moves on (`data-pinned="true"` on the article). The peek stays out, the summary stays aside, and the card keeps the lifted shadow and edge; it does not rise or swell — that is the pointer's cue, and it returns on hover. The pin swaps to a slashed pin and stays visible so the way back is always in reach. Pins are per tab and not saved; any number of cards can be pinned. A mouse click on the pin blurs the button so `:focus-within` does not hold the card open after an unpin.
- **Maximize** opens the issue page *over* the board. It is a `Link` to `/c/<id>` that the `@modal/(.)c/[externalId]` intercepting route turns into a dialog holding the same `CardSheet` the page renders. Esc, the backdrop, or the X step back in history; a reload of the same URL gives the full page. The title and "Open issue" are plain anchors on purpose — they go to the page, not the dialog.

Cards in the drawer (an `inbox` lane) get `.paper-card--flat`: flush, hairline-separated slips with no lift at rest. An in-tray is emptied, not read.

The whole card is a handle, open or closed: the title row, the status line, and the form — labels, tags, note, and the rating squares all pick the card up (the sensor's 6px threshold keeps a click a click). Only the two text fields keep `pointerdown` to themselves, because a press-and-move there is selecting text. Do not put a blanket `stopPropagation` on the form again: it made 60% of an open card inert, and the old hover flicker only hid that by collapsing the peek under the hand.

Do not put empty tactician fields in the resting chrome. E2E that clicks ratings or dates must `hover()` the card first.

See `docs/paper.md` for the surfaces, colours and motion these classes come from.
