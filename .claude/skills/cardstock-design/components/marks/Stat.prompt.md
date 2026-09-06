The pen — a decision the app recorded, written in the margin.

```jsx
<Stat tone={STATUS_TONE[card.status]}>{card.status}</Stat>
<Stat tone="blocked">forgotten</Stat>
<Stat tone="muted" flat>internal</Stat>
```

Six pixels of colour and a word in mono caps at 10px/0.09em. Never a filled pill, never a rounded badge. Tones: `wip`/`attention` amber, `blocked`/`danger` red, `info` blue, `success` green, `muted` grey, `ink`, `faint`.

Pen and highlighter never mix on one element — that is what makes a board look worked rather than decorated.
