# Board manage

Each board has a manage page at `/p/<project>/b/<board>/manage`. It is the
board-level home for **concepts** (tag groups) and **gates** (timeline
milestones). Those same editors still appear on the project page, one block
per board, so a folder with several boards can be reviewed in one place.

The page is letterhead plus two section folders, the same chrome as the
project page. People, board creation, and the forgotten-work window stay on
the project.

## Who can edit

Any project member can change concepts — they are the board's filter
vocabulary, and tracker files name tags by ID. Gates are owners and project
admins only (`canManageProject`), same as on the project page.

## Where to open it

- Board header: *Manage*
- Project page binder: *Manage* next to *Take stock*
- Cockpit and timeline nav
- Home folder: gear on the binder

Saving concepts or gates revalidates both the project page and this one.
Gates also revalidate the timeline.
