import { EpicLabel } from "@/components/epic-label";
import { statusChipClass } from "@/lib/card-status";
import { EFFORT_PEN, PRIORITY_PEN } from "@/lib/types";
import type { DemoCard, DemoLane } from "./demo";

/**
 * The board, drawn for a visitor who has not signed in.
 *
 * These are the same classes the real board uses, so the hover lift, the peek
 * and the pen squares behave here exactly as they do inside. What is missing
 * is everything that needs a session: the rail, the links, the drag. A card on
 * this page is a sheet under glass, and it is honest about that.
 */

function tintClass(tint?: string): string {
  return tint ? `card-color--${tint}` : "";
}

export function MockCard({
  card,
  flat = false,
}: {
  card: DemoCard;
  flat?: boolean;
}) {
  const status = card.status ?? "backlog";
  return (
    <article
      className={`paper-card relative p-2.5 ${flat ? "paper-card--flat" : ""} ${tintClass(card.tint)}`}
      data-timeline-signal={card.signal}
    >
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-[11.5px] text-[var(--color-grey-faint)]">
          #{card.id}
        </span>
        <p className="min-w-0 text-[18px] font-medium leading-snug">
          {card.title}
        </p>
      </div>
      {(card.epic || status !== "backlog" || card.signal) && (
        <div className="card-meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {card.epic && <EpicLabel name={card.epic} />}
          {status !== "backlog" && (
            <span className={statusChipClass(status)}>{status}</span>
          )}
          {card.signal === "forgotten" && (
            <span className="stat stat--blocked">forgotten</span>
          )}
          {card.signal === "overdue" && (
            <span className="stat stat--blocked">overdue</span>
          )}
        </div>
      )}
      {(card.priority || card.effort) && (
        <div className="card-rest">
          <div className="card-rest-inner">
            <div className="card-meta card-meta--summary mt-1 flex items-center gap-2">
              <span className="font-mono text-[11.5px] text-[var(--color-grey-faint)]">
                raised {card.raised}
              </span>
              <span className="card-meta-chips flex shrink-0 gap-1">
                {card.priority && (
                  <span className={`sq sq--on ${PRIORITY_PEN[card.priority]}`}>
                    P{card.priority}
                  </span>
                )}
                {card.effort && (
                  <span className={`sq sq--on ${EFFORT_PEN[card.effort]}`}>
                    {card.effort}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="card-peek">
        <div className="card-peek-inner">
          <div className="card-meta mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="stat stat--muted">raised {card.raised}</span>
            {card.tags?.map((tag, i) => (
              <span key={tag} className={`mark mark--${(i % 5) + 1}`}>
                {tag}
              </span>
            ))}
          </div>
          {card.note && (
            <p className="mt-1.5 text-[13px] leading-snug text-[var(--color-ink2)]">
              {card.note}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export function MockLane({ lane }: { lane: DemoLane }) {
  return (
    <section
      className={`paper-lane flex h-full flex-col gap-2 p-2 ${lane.drawer ? "paper-lane--drawer" : ""}`}
    >
      <header
        className={`lane-head ${lane.drawer ? "lane-head--soft" : ""} px-1`}
      >
        <h3 className="lane-name">{lane.name}</h3>
        <span className="font-mono text-[11.5px] text-[var(--color-grey-faint)]">
          {lane.cards.length}
        </span>
      </header>
      <div className={lane.drawer ? "flex flex-col" : "flex flex-col gap-2"}>
        {lane.cards.map((card) => (
          <MockCard key={card.id} card={card} flat={lane.drawer} />
        ))}
      </div>
    </section>
  );
}
