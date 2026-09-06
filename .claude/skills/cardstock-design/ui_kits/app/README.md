# cardstock — app UI kit

A click-through recreation of the cardstock app, built by reading
`src/app/**` and `src/components/**` in the attached codebase (not from
screenshots). It composes the design system's own primitives from
`_ds_bundle.js` and the brand's component classes in `styles/paper.css`.

Open `index.html`. Cosmetics and interaction are real; persistence, drag and
drop, realtime and auth are not.

## Screens

| File | Source it recreates | What works |
|---|---|---|
| `LoginScreen.jsx` | `src/app/login/page.tsx`, `login-form.tsx` | Sign-in / first-password toggle; submitting lands on Projects |
| `ProjectsScreen.jsx` | `src/app/page.tsx`, `src/components/binder.tsx` | Folders and binders; the tab and the cover both open |
| `ProjectScreen.jsx` | `src/app/p/[project]/page.tsx` | Letterhead, section folders, lane microcosm, roster, concept graph, the two big asks |
| `BoardScreen.jsx` | `src/components/board/board-view.tsx`, `lane-column.tsx`, `filter-bar.tsx` | Search, tag/priority/effort/status filters, clear filters, add card, pin a card, maximize / minimize a lane |
| `TimelineScreen.jsx` | `src/app/p/[project]/b/[board]/timeline`, `timeline-explorer.tsx` | Watchlist rows, window select, built/shipped columns |
| `CockpitScreen.jsx` | `src/components/cockpit/cockpit-view.tsx`, `task-map.tsx` | Epic tomes, task-light maps, outlook filter, epic search |
| `CardFace.jsx` | `src/components/board/card-item.tsx` | The card's resting chrome and its back (hover a card, or pin it) |
| `Shell.jsx` | `src/app/layout.tsx` | The paper topbar and its wordmark |
| `data.js` | `supabase/seed.sql` + `examples/tracker` | The demo project, its lanes, tag groups, cards and epics |

## Deliberately not built

The calendar corkboard month, card detail (`/c/[externalId]`), manage/settings
editors and the import/export dialogs exist in the source but are not
recreated here; their vocabulary is covered by the foundation cards
(`guidelines/colors-cork.html`) and the component cards.

Drag and drop is dnd-kit in the real app. Here lanes and cards are static in
place — the hover lift, the drag-ghost rotation and the drop-target edge are
all in the design system (`PaperCard variant="overlay"`, `.paper-lane--over`)
but no gesture is wired up.
