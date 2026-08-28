"use client";

import { useEffect, useState } from "react";
import {
  type CardHistoryEvent,
  type CardHistoryLane,
  formatCardEvent,
} from "@/lib/card-history";

/**
 * Card-page stamp log: clock, kind pen, then a sentence (who did what).
 *
 * `"use client"` does not make SSR use the browser zone. History mounts with
 * `formatCardEvent` (no `timeZone`), then a `useEffect` re-render so the
 * clock becomes local. Kind/actor/facts are deterministic and do not flash.
 * `suppressHydrationWarning` stays on `<time>` per spec.
 */
export function CardHistory({
  events,
  lanes,
}: {
  events: CardHistoryEvent[];
  lanes: CardHistoryLane[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        History
      </h2>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing recorded.</p>
      ) : (
        <ul className="grid gap-y-1 text-xs">
          {events.map((event) => {
            const row = formatCardEvent(event, lanes);
            return (
              <li
                key={event.id}
                className="grid grid-cols-[8.5rem_auto_minmax(0,1fr)] items-baseline gap-x-2"
              >
                <time
                  dateTime={event.at}
                  suppressHydrationWarning
                  className="whitespace-nowrap font-mono text-muted-foreground tabular-nums"
                >
                  {mounted ? row.clock : row.clock}
                </time>
                <span className={`stat ${row.stat}`}>{row.kind}</span>
                <span>
                  {row.actor}
                  {row.facts ? ` ${row.facts}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
