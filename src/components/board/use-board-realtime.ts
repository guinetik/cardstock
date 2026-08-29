"use client";
import { useEffect, useRef } from "react";
import { createBoardRefresh } from "@/lib/board-refresh";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Card, Lane } from "@/lib/types";

type Snapshot = { cards: Card[]; lanes: Lane[] };

/**
 * Keep the board in step with everyone else's edits.
 *
 * Realtime only rings the bell; the hook then refetches the board through the
 * same loader the page uses. A refetch waits while this tab has an optimistic
 * edit in flight, so a teammate's move never snaps your own drag back.
 */
export function useBoardRealtime(opts: {
  boardId: string;
  busy: boolean;
  fetch: () => Promise<Snapshot>;
  apply: (s: Snapshot) => void;
}) {
  const latest = useRef(opts);
  latest.current = opts;
  const refresh = useRef<ReturnType<typeof createBoardRefresh> | null>(null);

  useEffect(() => {
    const r = createBoardRefresh<Snapshot>({
      debounceMs: 250,
      fetch: () => latest.current.fetch(),
      apply: (s) => latest.current.apply(s),
      isBusy: () => latest.current.busy,
      onError: (e) => console.warn("board refresh failed", e),
    });
    refresh.current = r;
    const db = supabaseBrowser();
    const filter = `board_id=eq.${opts.boardId}`;
    let cancelled = false;
    const channel = db.channel(`board:${opts.boardId}`);
    (async () => {
      // Realtime enforces RLS with the token it joined with. The browser
      // client reads its session from cookies asynchronously, so without this
      // the channel joins as `anon` and silently hears nothing.
      const {
        data: { session },
      } = await db.auth.getSession();
      if (cancelled) return;
      if (session) await db.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cards", filter },
          () => r.nudge(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "lanes", filter },
          () => r.nudge(),
        )
        // card_tags has no board column; RLS still scopes it to our projects
        // and a refetch for another board's tag is harmless.
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "card_tags" },
          () => r.nudge(),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      r.dispose();
      refresh.current = null;
      db.removeChannel(channel);
    };
  }, [opts.boardId]);

  // A deferred refresh runs as soon as the local action settles.
  useEffect(() => {
    if (!opts.busy) refresh.current?.settled();
  }, [opts.busy]);
}
