# Calendar

A month of **target dates**. Board: `/p/<project>/b/<board>/calendar`. Project: `/p/<project>/calendar`. Timeline remains the raised-date rail; the cockpit remains the epic fleet.

The board calendar letterhead names the project, the month, and the board; view links (Board, Epic Cockpit, Timeline, Manage, Project) sit below in the same row as Previous/Next month. The project calendar links back to the project folder the same way.

Cards sit on the UTC day in `target_date`. No target (including a rough label only) sits in **Unscheduled**. Drag a slip onto a day to set the target; drag onto the tray to clear it — the hovered drop target frames itself in dashed ink. In the grid, grab a stub anywhere; a plain click (no movement) opens the card. Archived cards are omitted. Neighbour-month days fill the grid when the month does not start on Sunday; dropping on them does not change the visible month.

In the day grid each slip rests as a bare `#id` stub — a small tilted post-it, wrapped in rows. Hover or focus straightens it and floats a larger copy on top of the month (full title, board name on the project calendar, raised-date age). The day square stays the same size; hovering a day or a slip must not stretch the cell or shift its neighbours. Days show eight stubs, then a **+N** chip opens every card that day. The tray and the +N popover keep `#id` + title rows. The project calendar offers chips to hide boards (`?boards=`).

`?month=YYYY-MM` is the visible month. Garbage falls back to today (UTC).
