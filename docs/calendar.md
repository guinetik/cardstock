# Calendar

A month of **target dates**. Board: `/p/<project>/b/<board>/calendar`. Project: `/p/<project>/calendar`. Timeline remains the raised-date rail; the cockpit remains the epic fleet.

Cards sit on the UTC day in `target_date`. No target (including a rough label only) sits in **Unscheduled**. Drag a slip onto a day to set the target; drag onto the tray to clear it. Archived cards are omitted. Neighbour-month days fill the grid when the month does not start on Sunday; dropping on them does not change the visible month.

Each slip is `#id`, title, and the same raised-date age chip as the board. The project calendar also prints the board name and offers chips to hide boards (`?boards=`).

`?month=YYYY-MM` is the visible month. Garbage falls back to today (UTC).
