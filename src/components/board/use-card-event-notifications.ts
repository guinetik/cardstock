"use client";
import { useEffect, useRef } from "react";
import {
  type CardEventRow,
  cardEventNotice,
  type NotificationPrefs,
} from "@/lib/notify";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Tell the member what teammates are doing on this board, as OS
 * notifications. `card_events` inserts arrive on realtime; the pure
 * {@link cardEventNotice} decides copy and silence, and this hook is only
 * the shell: subscription, board scoping, and the Notification call.
 *
 * Scoping: card_events has no board column, so a moved/commented event
 * counts only when its card is already on this board's desk, and a created
 * event only when its payload names this board.
 */
export function useCardEventNotifications(opts: {
  boardId: string;
  selfEmail: string;
  prefs: NotificationPrefs;
  cardTitle: (cardId: string) => string | undefined;
  laneName: (laneId: string) => string | undefined;
  knownCard: (cardId: string) => boolean;
}) {
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    // Without permission (or with the pref off) there is nothing to hear.
    // The profile page is where both get switched on; a change re-renders
    // through fresh prefs, and this effect re-subscribes.
    if (!opts.prefs.enabled) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const db = supabaseBrowser();
    let cancelled = false;
    const channel = db.channel(`board-notify:${opts.boardId}`);
    (async () => {
      // Same auth dance as the doorbell: realtime enforces RLS with the
      // token it joined with, and the browser session loads asynchronously.
      const {
        data: { session },
      } = await db.auth.getSession();
      if (cancelled) return;
      if (session) await db.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "card_events" },
          (message) => {
            const now = latest.current;
            const event = message.new as CardEventRow;
            const onBoard =
              event.kind === "created"
                ? event.payload?.board_id === now.boardId
                : now.knownCard(event.card_id);
            if (!onBoard) return;
            const notice = cardEventNotice(event, {
              selfEmail: now.selfEmail,
              prefs: now.prefs,
              cardTitle: now.cardTitle,
              laneName: now.laneName,
            });
            if (!notice) return;
            try {
              new Notification(notice.title, {
                body: notice.body,
                tag: notice.tag,
              });
            } catch {
              // Some platforms (Android Chrome) only allow notifications
              // from a service worker; failing quietly is correct here.
            }
          },
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      db.removeChannel(channel);
    };
  }, [opts.boardId, opts.prefs.enabled]);
}
