A decision written as a filled square — priority and effort.

```jsx
<Sq pen={PRIORITY_PEN[card.priority]} on>P{card.priority}</Sq>
<Sq pen={EFFORT_PEN[card.effort]} on>{card.effort}</Sq>
<Sq>P2</Sq>  {/* not set */}
```

21px square, mono 10.5px. P1 red, P2 blue, P3 violet; effort L green, M amber, H red. Unset squares stay empty with a hairline edge, so a row of them reads as a form waiting to be filled in.
