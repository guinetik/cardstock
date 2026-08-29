# Card color — app types, actions, and history

Kanban cards carry an optional `color` field typed as `CardColor | null`. The board loader selects `cards.color`. Create and patch server actions validate untrusted values with `isCardColor` before any write, persist `color` (or `null` to clear), and return `{ ok: false, error: "Invalid color." }` for unknown names. `createCard` includes `color` in its insert and in the returned-card select.

An edit records `{ color }` on the existing `edited` event. History formats that key as `changed the color` and never prints the stored name.
