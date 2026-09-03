"use client";
import { useEffect, useRef } from "react";
import { createBoardRefresh } from "@/lib/board-refresh";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * The board's realtime doorbell, sized for the calendar: any card change on
 * the watched boards asks the router for a fresh server render — the page
 * has no client snapshot to patch, so a refresh IS the apply. Rings are
 * debounced and wait while this tab is dragging or persisting a drop, so a
 * teammate's edit never yanks a slip out of the hand.
 */
export function useCalendarRealtime(opts: {
  boardIds: string[];
  /** True while a drag is active or a drop is awaiting the server. */
  busy: boolean;
  refresh: () => void;
}) {
  const latest = useRef(opts);
  latest.current = opts;
  const doorbell = useRef<{ settled: () => void } | null>(null);
  const key = opts.boardIds.join(",");

  useEffect(() => {
    if (!key) return;
    const r = createBoardRefresh<void>({
      debounceMs: 250,
      fetch: async () => latest.current.refresh(),
      apply: () => {},
      isBusy: () => latest.current.busy,
      onError: (e) => console.warn("calendar refresh failed", e),
    });
    doorbell.current = r;
    const db = supabaseBrowser();
    const ids = key.split(",");
    const filter =
      ids.length === 1
        ? `board_id=eq.${ids[0]}`
        : `board_id=in.(${ids.join(",")})`;
    let cancelled = false;
    const channel = db.channel(`calendar:${key}`);
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
        .subscribe();
    })();
    return () => {
      cancelled = true;
      r.dispose();
      doorbell.current = null;
      db.removeChannel(channel);
    };
  }, [key]);

  // A deferred refresh runs as soon as the drag or drop settles.
  useEffect(() => {
    if (!opts.busy) doorbell.current?.settled();
  }, [opts.busy]);
}
