# Lane management

Lanes can use the same optional tint palette as cards. The tint is stored on
`lanes.color`, applied to the full and minimized board lane, and carried into
the miniature lane map on the project page. A card's own tint remains
independent of its lane.

Every live lane has a context menu. Moving all cards left or right targets the
immediately adjacent live lane, requires confirmation, ignores active filters,
and appends the cards after the destination's existing cards. Archive is never
an automatic bulk-move destination.

Manual lanes can be re-ranked by card number ascending or descending. The
confirmation warns that this replaces the shared manual order. The Unsorted
lane keeps its existing member-specific display order and is therefore not
eligible for persisted re-ranking.
