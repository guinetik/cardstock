# Live board

Two people on the same board see each other's edits without reloading.

## How it works

Realtime is a doorbell, not a data feed. The board subscribes to Supabase
Realtime `postgres_changes` on `cards` and `lanes` (filtered by `board_id`)
and `card_tags` (unfiltered — it has no board column; RLS still scopes it).
Every event just calls `nudge()` on a small scheduler (`src/lib/board-refresh.ts`),
which debounces 250 ms and then refetches `{cards, lanes}` through the
`refreshBoard` server action — the same `loadBoard` the page uses, so a live
refresh can never disagree with a reload.

The card the board renders is a composite (`tag_ids`, `lane_entered_at`), which
is why rows from the event payload are not patched into state directly.

## Optimistic edits

A refetch waits while this tab has an action in flight (`useTransition`'s
`pending`, or a lane operation) and runs as soon as it settles. That keeps a
teammate's event from snapping your half-committed drag back. Your own commit
fires its own event, so state always converges on the database.

## Auth

Realtime evaluates RLS with the token the channel joined with. The browser
client reads its session from cookies asynchronously, so the hook
(`src/components/board/use-board-realtime.ts`) awaits `getSession()` and calls
`realtime.setAuth()` before subscribing. Without that the channel joins as
`anon`, reports "Subscribed", and hears nothing.

## Database

`supabase/migrations/20260831000000_realtime_board.sql` adds the three tables to
the `supabase_realtime` publication. Hosted projects pick it up with
`supabase db push` (see `deploy.md`). Realtime is included in the Supabase Free
plan: 200 concurrent connections and 2M messages/month.

## Tests

- `src/lib/board-refresh.test.ts` — debounce, defer-while-busy, in-flight
  coalescing, error recovery, dispose.
- `e2e/realtime.spec.ts` — two browser contexts; a drag in one lands in the
  other without a reload.
