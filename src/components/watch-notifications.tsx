"use client";

import { useEffect } from "react";
import type { NotificationPrefs } from "@/lib/notify";
import { supabaseBrowser } from "@/lib/supabase/client";

/** One subscription in the app shell, so watched cards follow you across pages. */
export function WatchNotifications({
  memberId,
  email,
  prefs,
}: {
  memberId: string;
  email: string;
  prefs: NotificationPrefs;
}) {
  useEffect(() => {
    if (
      !prefs.enabled ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    const db = supabaseBrowser();
    const channel = db.channel(`watch-notifications:${memberId}`);
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await db.auth.getSession();
      if (cancelled) return;
      if (session) await db.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "watch_notifications",
            filter: `member_id=eq.${memberId}`,
          },
          async (message) => {
            const notice = message.new as {
              id: string;
              actor: string | null;
              kind: "watchStarted" | "watchedMoved";
              card_id: string;
              title: string;
              body: string;
            };
            if (
              notice.actor?.toLowerCase() === email.toLowerCase() ||
              !prefs.kinds[notice.kind]
            )
              return;
            // Resolve through RLS again before displaying or opening the card.
            const { data: card } = await db
              .from("cards")
              .select("external_id, boards!inner(slug, projects!inner(slug))")
              .eq("id", notice.card_id)
              .maybeSingle();
            if (!card || cancelled) return;
            if (notice.kind === "watchedMoved") {
              const { data: watch } = await db
                .from("card_watches")
                .select("card_id")
                .eq("card_id", notice.card_id)
                .maybeSingle();
              if (!watch || cancelled) return;
            }
            const scope = card as unknown as {
              external_id: string;
              boards: { slug: string; projects: { slug: string } };
            };
            const path = `/p/${scope.boards.projects.slug}/b/${scope.boards.slug}/c/${scope.external_id}`;
            try {
              const popup = new Notification(notice.title, {
                body: notice.body,
                tag: `card:${notice.card_id}`,
              });
              popup.onclick = () => {
                window.focus();
                window.location.assign(path);
                popup.close();
              };
            } catch {
              /* Platforms requiring a service worker cannot display these. */
            }
          },
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      void db.removeChannel(channel);
    };
  }, [memberId, email, prefs.enabled, prefs.kinds]);
  return null;
}
