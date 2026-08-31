import Link from "next/link";
import { TimelineWindowSelect } from "@/components/timeline-window-select";
import { daysSince } from "@/lib/timeline";

export interface RecentOutcomeItem {
  id: string;
  externalId: string;
  title: string;
  href: string;
  at: string;
}

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function prettyDate(value: string) {
  return DATE.format(
    new Date(value.length === 10 ? `${value}T00:00:00Z` : value),
  );
}

function relativeDate(value: string, today: string) {
  const age = daysSince(value, today);
  if (age === 0) return "Today";
  if (age === 1) return "Yesterday";
  return `${age}d ago`;
}

function OutcomeColumn({
  title,
  items,
  today,
  color,
}: {
  title: "Built" | "Shipped";
  items: RecentOutcomeItem[];
  today: string;
  color: string;
}) {
  return (
    <section
      className="border-t-2 bg-[var(--surface-card)] px-4 py-3"
      style={{ borderColor: color }}
      aria-labelledby={`recent-${title.toLowerCase()}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`recent-${title.toLowerCase()}`} className="text-lg">
          {title}
        </h3>
        <span className="font-mono text-xs" style={{ color }}>
          {items.length}
        </span>
      </div>
      {items.length ? (
        <ul className="mt-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-[var(--border-hairline)] py-2.5 last:border-0"
            >
              <Link
                href={item.href}
                className="min-w-0 text-sm hover:underline"
              >
                <span className="font-mono text-[10px] text-[var(--color-grey-faint)]">
                  #{item.externalId}
                </span>{" "}
                {item.title}
              </Link>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ color }}
              >
                {relativeDate(item.at, today)}
              </span>
              <time
                dateTime={item.at}
                className="text-[10px] text-[var(--color-grey)]"
              >
                {prettyDate(item.at)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-5 text-xs text-[var(--color-grey)]">
          Nothing {title.toLowerCase()} in this window.
        </p>
      )}
    </section>
  );
}

export function RecentDeliveryPulse({
  built,
  shipped,
  today,
  windowDays,
  windowStart,
}: {
  built: RecentOutcomeItem[];
  shipped: RecentOutcomeItem[];
  today: string;
  windowDays: number;
  windowStart: string;
}) {
  return (
    <section className="mb-9" aria-labelledby="recent-delivery-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-[var(--border-strong)] pb-2">
        <div>
          <h2 id="recent-delivery-heading" className="text-xl">
            Relative to today
          </h2>
          <p className="text-xs text-[var(--color-grey)]">
            What crossed Built and Shipped during the last {windowDays} days.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-grey)]">
            {prettyDate(windowStart)} → today
          </span>
          <TimelineWindowSelect value={windowDays} />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <OutcomeColumn
          title="Built"
          items={built}
          today={today}
          color="var(--pen-blue)"
        />
        <OutcomeColumn
          title="Shipped"
          items={shipped}
          today={today}
          color="var(--pen-green)"
        />
      </div>
    </section>
  );
}
