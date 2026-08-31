import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RecentDeliveryPulse,
  type RecentOutcomeItem,
} from "@/components/recent-delivery-pulse";
import { TimelineExplorer } from "@/components/timeline-explorer";
import type { TimelineRailItem } from "@/components/timeline-rail";
import { loadBoard } from "@/lib/board-data";
import { currentMember } from "@/lib/supabase/server";
import {
  addTimelineDays,
  daysSince,
  forgottenAfterDays,
  isInTimelineWindow,
  type TimelineSignal,
  timelineSignal,
  timelineToday,
  timelineWindowDays,
} from "@/lib/timeline";
import { EFFORT_PEN, PRIORITY_LABEL, PRIORITY_PEN } from "@/lib/types";

export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const SIGNAL_LABEL: Record<TimelineSignal, string> = {
  forgotten: "Forgotten",
  overdue: "Overdue",
  planned: "Planned",
  active: "Open",
  delivered: "Delivered",
};

const SIGNAL_CLASS: Record<TimelineSignal, string> = {
  forgotten: "text-[var(--pen-red)] border-[var(--pen-red)]",
  overdue: "text-[var(--pen-amber)] border-[var(--pen-amber)]",
  planned: "text-[var(--pen-blue)] border-[var(--pen-blue)]",
  active: "text-[var(--color-grey)] border-[var(--border-strong)]",
  delivered: "text-[var(--pen-green)] border-[var(--pen-green)]",
};

function prettyDate(value: string) {
  return DATE.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

/** A date-raised rail: the age of work is visible even when nobody scheduled it. */
export default async function TimelinePage(
  props: PageProps<"/p/[project]/b/[board]/timeline">,
) {
  const { project, board } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");

  const data = await loadBoard(project, board);
  const laneById = new Map(data.lanes.map((lane) => [lane.id, lane]));
  const today = timelineToday();
  const watchDays = forgottenAfterDays(data.project.settings);
  const pulseDays = timelineWindowDays((await props.searchParams).window);
  const back = `/p/${project}/b/${board}`;
  const visible = data.cards.filter((card) => {
    const lane = laneById.get(card.lane_id ?? "");
    return !card.archived_at && lane?.kind !== "archive";
  });
  const signals = new Map(
    visible.map((card) => [
      card.id,
      timelineSignal(card, laneById.get(card.lane_id ?? ""), today, watchDays),
    ]),
  );
  const raised = visible
    .filter((card) => card.raised_on)
    .sort((a, b) =>
      a.raised_on === b.raised_on
        ? a.external_id.localeCompare(b.external_id, undefined, {
            numeric: true,
          })
        : b.raised_on!.localeCompare(a.raised_on!),
    );
  const timelineItems: TimelineRailItem[] = raised.map((card) => {
    const signal = signals.get(card.id) ?? "active";
    return {
      id: card.id,
      externalId: card.external_id,
      title: card.title,
      href: `${back}/c/${card.external_id}`,
      epicName: card.epic,
      raisedOn: card.raised_on!,
      laneName: laneById.get(card.lane_id ?? "")?.name ?? "No lane",
      status: card.status,
      signal,
      targetDate: card.target_date,
      targetLabel: card.target_label,
      deliveredAt: card.delivered_at ?? card.shipped_on,
      priority: card.priority,
      effort: card.effort,
    };
  });
  const attention = visible
    .filter((card) => {
      const signal = signals.get(card.id);
      return signal === "forgotten" || signal === "overdue";
    })
    .sort((a, b) => {
      const signalOrder = (value: TimelineSignal | undefined) =>
        value === "forgotten" ? 0 : 1;
      return (
        signalOrder(signals.get(a.id)) - signalOrder(signals.get(b.id)) ||
        (a.raised_on ?? "9999").localeCompare(b.raised_on ?? "9999")
      );
    });
  const missingRaised = visible.filter(
    (card) => !card.raised_on && signals.get(card.id) !== "delivered",
  );
  const planned = visible.filter((card) => card.target_date).length;
  const forgotten = visible.filter(
    (card) => signals.get(card.id) === "forgotten",
  ).length;
  const windowStart = addTimelineDays(today, -(pulseDays - 1));
  const toRecentItem = (
    card: (typeof data.cards)[number],
    at: string,
  ): RecentOutcomeItem => ({
    id: card.id,
    externalId: card.external_id,
    title: card.title,
    href: `${back}/c/${card.external_id}`,
    at,
  });
  // Outcomes remain throughput even if the card was archived afterwards.
  const recentBuilt = data.cards
    .filter(
      (card) =>
        !!card.built_at && isInTimelineWindow(card.built_at, today, pulseDays),
    )
    .map((card) => toRecentItem(card, card.built_at!))
    .sort((a, b) => b.at.localeCompare(a.at));
  const recentShipped = data.cards
    .filter(
      (card) =>
        !!card.delivered_at &&
        isInTimelineWindow(card.delivered_at, today, pulseDays),
    )
    .map((card) => toRecentItem(card, card.delivered_at!))
    .sort((a, b) => b.at.localeCompare(a.at));

  const compactRow = (card: (typeof visible)[number]) => {
    const signal = signals.get(card.id) ?? "active";
    const lane = laneById.get(card.lane_id ?? "");
    const detail =
      signal === "forgotten" && card.raised_on
        ? `${daysSince(card.raised_on, today)} days since raised · no target`
        : signal === "overdue" && card.target_date
          ? `Target was ${prettyDate(card.target_date)}`
          : card.target_date
            ? `Target ${prettyDate(card.target_date)}`
            : (card.target_label ?? "No target");
    return (
      <li
        key={card.id}
        className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-[var(--border-hairline)] py-3 text-sm sm:flex sm:flex-wrap sm:items-center"
      >
        <span
          className={`w-20 shrink-0 border-l-2 pl-2 text-[9px] font-semibold uppercase tracking-[0.1em] ${SIGNAL_CLASS[signal]}`}
        >
          {SIGNAL_LABEL[signal]}
        </span>
        <Link
          href={`${back}/c/${card.external_id}`}
          className="min-w-0 break-words hover:underline sm:flex-1"
        >
          <span className="font-mono text-xs text-[var(--color-grey-faint)]">
            #{card.external_id}
          </span>{" "}
          {card.title}
        </Link>
        <span className="col-start-2 row-start-2 text-xs text-[var(--color-grey)]">
          {detail}
        </span>
        <span className="col-span-2 flex shrink-0 items-center justify-end gap-1.5 sm:justify-start">
          {card.priority && (
            <span className={`sq sq--on ${PRIORITY_PEN[card.priority]}`}>
              {PRIORITY_LABEL[card.priority]}
            </span>
          )}
          {card.effort && (
            <span className={`sq sq--on ${EFFORT_PEN[card.effort]}`}>
              {card.effort}
            </span>
          )}
          <span className="w-20 text-right text-[9px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]">
            {lane?.name ?? "No lane"}
          </span>
        </span>
      </li>
    );
  };

  return (
    <main className="mx-auto w-full max-w-5xl p-6 pb-14">
      <Link
        href={back}
        className="text-xs text-muted-foreground hover:underline"
      >
        ← {data.board.name}
      </Link>

      <header className="mt-1 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-strong)] pb-5">
        <div>
          <h1 className="text-[30px] leading-tight">Timeline</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Work begins at its raised date. The watchlist calls out anything
            still unplanned after {watchDays} days.
          </p>
        </div>
        <Link
          href={`/p/${project}#settings-heading`}
          className="paper-link text-xs"
        >
          {watchDays}-day project window
        </Link>
      </header>

      <div className="my-5 flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--border-hairline)] pb-5 text-xs text-[var(--color-grey)]">
        <span>
          <strong className="font-mono text-base text-[var(--color-ink)]">
            {raised.length}
          </strong>{" "}
          raised
        </span>
        <span>
          <strong className="font-mono text-base text-[var(--pen-blue)]">
            {planned}
          </strong>{" "}
          dated
        </span>
        <span>
          <strong className="font-mono text-base text-[var(--pen-red)]">
            {forgotten}
          </strong>{" "}
          forgotten
        </span>
        <span>
          <strong className="font-mono text-base text-[var(--color-grey)]">
            {missingRaised.length}
          </strong>{" "}
          missing a raised date
        </span>
      </div>

      {attention.length > 0 && (
        <section
          className="mb-8 border-l-4 border-[var(--pen-red)] bg-[var(--surface-card)] px-4 py-3 shadow-[var(--shadow-card)]"
          aria-labelledby="attention-heading"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="attention-heading" className="text-xl">
              Needs attention
            </h2>
            <span className="font-mono text-xs text-[var(--pen-red)]">
              {attention.length} {attention.length === 1 ? "card" : "cards"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-grey)]">
            Unplanned past the project window or still open after its target.
          </p>
          <ul className="mt-2">{attention.map(compactRow)}</ul>
        </section>
      )}

      <RecentDeliveryPulse
        built={recentBuilt}
        shipped={recentShipped}
        today={today}
        windowDays={pulseDays}
        windowStart={windowStart}
      />

      <section aria-labelledby="flow-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <h2 id="flow-heading" className="text-xl">
              Raised chronology
            </h2>
            <p className="text-xs text-[var(--color-grey)]">
              Newest first, with the full title and next date kept together.
            </p>
          </div>
        </div>
        {timelineItems.length ? (
          <TimelineExplorer
            items={timelineItems}
            today={today}
            watchDays={watchDays}
          />
        ) : (
          <p className="border-y border-[var(--border-hairline)] py-8 text-sm text-muted-foreground">
            No raised dates yet. Add a raised date to place work on this rail.
          </p>
        )}
      </section>

      {missingRaised.length > 0 && (
        <section className="mt-9" aria-labelledby="missing-raised-heading">
          <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-[var(--border-strong)] pb-2">
            <div>
              <h2 id="missing-raised-heading" className="text-xl">
                Missing raised dates
              </h2>
              <p className="text-xs text-[var(--color-grey)]">
                These active cards cannot be aged or checked for forgotten work.
              </p>
            </div>
            <span className="font-mono text-xs text-[var(--color-grey)]">
              {missingRaised.length}
            </span>
          </div>
          <ul>{missingRaised.map(compactRow)}</ul>
        </section>
      )}
    </main>
  );
}
