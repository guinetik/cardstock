# Board manage

Each board has a manage page at `/p/<project>/b/<board>/manage`. It is the
board-level home for **concepts** (tag groups), the **card template**,
**stencils**, and **gates** (timeline milestones). The concepts and gates
editors still appear on the project page, one block
per board, so a folder with several boards can be reviewed in one place.

The page is letterhead plus section folders, the same chrome as the
project page. People, board creation, and the forgotten-work window stay on
the project.

## Who can edit

Any project member can change concepts — they are the board's filter
vocabulary, and tracker files name tags by ID. Gates, the card template, and
stencils are owners and project admins only (`canManageProject`).

## Card template and stencils

The card template supplies the Markdown skeleton for a blank card. The
**stencils** section directly below it defines named, reusable card shapes
with text, checklist steps, area, effort, and tags. The lane's add-card menu
offers **Blank card** and the available stencils. Editing or deleting a stencil
leaves existing cards unchanged. See [Card stencils](stencils.md).

## Where to open it

- Board header: *Manage*
- Project page binder: *Go to Board*, *Epic Cockpit*, and *Manage*
- Cockpit and timeline nav
- Home folder: gear on the binder

Saving concepts or gates revalidates both the project page and this one.
Gates also revalidate the timeline.
