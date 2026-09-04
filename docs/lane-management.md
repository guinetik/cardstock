# Lane management

Lanes can use the same optional tint palette as cards. The tint is stored on
`lanes.color`, applied to the full and minimized board lane, and carried into
the miniature lane map on the project page. A card's own tint remains
independent of its lane.

Every live lane has a context menu, including the archive lane. Moving all
cards left or right targets the immediately adjacent live lane, requires
confirmation, ignores active filters, and appends the cards after the
destination's existing cards. Archive is never an automatic bulk-move
destination.

Manual lanes can be re-ranked by card number ascending or descending. The
confirmation warns that this replaces the shared manual order. The Unsorted
lane keeps its existing member-specific display order and is therefore not
eligible for persisted re-ranking.

Every lane can be renamed and reordered. Edit changes the display name (and
color) only — the lane's `key` and `kind` are never editable, so a lane whose
key is `done` can be labelled anything and its frontmatter still reads
`lane: done`. The menu no longer carries "Move lane left/right": lanes reorder
by dragging the grip handle in the lane header, on the same drag-and-drop
surface as cards.

Remove is gated by kind, not by name: the `inbox`, `done` and `archive` kinds
have no Remove item at all, since removing them is refused server-side
('Icebox, done and archive lanes cannot be removed'). Every other lane offers
Remove.

A new board seeds four lanes: Icebox (`unsorted`/`inbox`), Doing (`now`/
`work`), Zenbox (`done`/`done`), Archive (`archive`/`archive`).
