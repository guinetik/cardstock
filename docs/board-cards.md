# Board card density

Board cards rest as **`#id`, title, epic, and the decisions already made** — the two pen squares for priority and difficulty, plus a status word when it is not `backlog`. That is the bird's-eye scan. Unrated cards show nothing rather than empty slots.

Hover (or keyboard focus-within) lifts the card out of the lane and opens `.card-peek`. The resting summary (`.card-rest`) hides at the same moment, so nothing is on screen twice. The drag overlay stays compact so the ghost does not balloon.

## The back of the card

The peek is `.card-form`: a label column in the margin and values in the body, like the back of an index card someone has filled in. Every row is named, so nothing floats unexplained.

| Row | What it holds |
|---|---|
| Tags | Highlighter marks in their group's colour |
| Target | Two stacked fields — a real day, **or** a rough date in words when no day is agreed |
| Diff | L / M / H, with the chosen one spelled out beside the squares |
| *Priority* | P1–P3, labelled with the board's own `priority_label` |
| Note | The card summary |
| Area | Frontmatter area |

The two date fields were the confusing part of the old layout: they sat side by side with no labels, and nothing said one was a committed day and the other a phrase. They are now one **Target** row, stacked, and the second reads `or a rough date — end of Q3`.

Cards in the drawer (an `inbox` lane) get `.paper-card--flat`: flush, hairline-separated slips with no lift at rest. An in-tray is emptied, not read.

Do not put empty tactician fields in the resting chrome. E2E that clicks ratings or dates must `hover()` the card first.

See `docs/paper.md` for the surfaces, colours and motion these classes come from.
