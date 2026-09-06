`BoardCard` is cardstock's signature component — one filed sheet on a board. Use it for any card face on a board, in a lane, or as a drag ghost.

```jsx
<BoardCard id="1" title="Sign-up form loses what you typed when the email is invalid"
  epic="Onboarding" status="backlog" raised="Aug 1" signal="forgotten"
  priority={1} effort="L" note="Validation clears the whole form."
  tags={[{ name: "Onboarding", hue: 2 }, { name: "Bug", hue: 4 }]} />
```

Resting, a card shows only `#id`, title, epic, status and the decisions (P1-P3, L/M/H squares plus the raised date and age gauge). Everything else is the *back* of the card and opens on hover after `--motion-dwell`; the resting row steps aside on the same clock so the card never goes blank.

Variants: `flat` for slips loose in the inbox drawer (no side edges, no lift), `overlay` for the card in hand (the only rotation in the product), `pinned` to leave the back out after the pointer moves on.

Tags carry their *group's* hue, so the same word is the same colour in the filter bar, on the card, and on the card page. Never mix a pen and a highlighter on one element.
