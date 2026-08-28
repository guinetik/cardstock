"use client";

import {
  type CardHistoryEvent,
  type CardHistoryLane,
  formatCardEvent,
} from "@/lib/card-history";

/**
 * Card-page stamp log: clock, kind pen, actor, facts. No payload dump.
 *
 * Client so the clock uses the browser time zone. Kind/actor/facts are
 * deterministic; only `<time>` may differ between SSR and hydrate.
 */
export function CardHistory({
  events,
  lanes,
}: {
  events: CardHistoryEvent[];
  lanes: CardHistoryLane[];
}) {
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
                className="grid grid-cols-[7.5rem_auto_minmax(0,1fr)] items-baseline gap-x-2"
              >
                <time
                  dateTime={event.at}
                  suppressHydrationWarning
                  className="font-mono text-muted-foreground tabular-nums"
                >
                  {row.clock}
                </time>
                <span className={`stat ${row.stat}`}>{row.kind}</span>
                <span>
                  <span className="font-mono text-muted-foreground">
                    {row.actor}
                  </span>
                  {row.facts ? <> {row.facts}</> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
