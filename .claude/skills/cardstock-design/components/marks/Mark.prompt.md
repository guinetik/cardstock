The highlighter — a swipe the reader made. **Tags and nothing else.**

```jsx
{groups.map((g, i) => g.tags.map(t => <Mark key={t.id} hue={markHue(i)}>{t.name}</Mark>))}
<Mark hue={4} off>unassigned tag</Mark>
```

A mark is a swipe: no border, no radius, uneven ends, a fraction of a degree off level, and consecutive marks alternate their tilt so a row never looks stamped. Hovering is a second pass of the marker — two swipes, darker.

Hue belongs to the tag **group**, in board order, via `markHue(index)`. So the same tag is the same yellow in the filter bar, on the card, and on the card page. `off` is an unassigned tag: the same word under a pencil rule, previewing the swipe at half pressure on hover.
