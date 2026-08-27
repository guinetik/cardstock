# Board card density

Board cards rest as **`#id`, title, epic**. That is the bird’s-eye scan.

Hover (or keyboard focus-within) opens `.card-peek`: status, tags, date inputs, ratings, summary/area. The drag overlay stays compact so the ghost does not balloon.

Touch devices without hover open the peek on focus-within. The title link still goes to the card page.

Do not put empty tactician fields in the resting chrome. E2E that clicks ratings or dates must `hover()` the card first.
