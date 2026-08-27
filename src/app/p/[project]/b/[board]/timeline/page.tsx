import Link from "next/link";
import { redirect } from "next/navigation";
import { loadBoard } from "@/lib/board-data";
import { currentMember } from "@/lib/supabase/server";
import { EFFORT_PEN, PRIORITY_LABEL, PRIORITY_PEN } from "@/lib/types";

export const dynamic = "force-dynamic";

const MONTH = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "September, October, November, and December in front of me" — cards by target month, then the unscheduled. */
export default async function TimelinePage(
  props: PageProps<"/p/[project]/b/[board]/timeline">,
) {
  const { project, board } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const data = await loadBoard(project, board);
  const laneName = new Map(data.lanes.map((l) => [l.id, l]));
  const open = data.cards.filter(
    (c) => !c.archived_at && laneName.get(c.lane_id ?? "")?.kind !== "archive",
  );
  const dated = open
    .filter((c) => c.target_date)
    .sort((a, b) => (a.target_date! < b.target_date! ? -1 : 1));
  const byMonth = new Map<string, typeof dated>();
  for (const c of dated) {
    const k = c.target_date!.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), c]);
  }
  const labelled = open.filter((c) => !c.target_date && c.target_label);
  const back = `/p/${project}/b/${board}`;
  // A printed schedule: hairline-ruled rows, not a stack of cards.
  const row = (c: (typeof open)[number]) => (
    <li
      key={c.id}
      className="flex items-baseline gap-4 border-b border-[var(--border-hairline)] py-2.5 text-sm"
    >
      <span
        className={`w-24 shrink-0 text-xs text-[var(--color-grey)] ${c.target_date ? "font-mono" : "italic"}`}
      >
        {c.target_date ?? c.target_label}
      </span>
      <Link href={`${back}/c/${c.external_id}`} className="hover:underline">
        <span className="font-mono text-xs text-[var(--color-grey-faint)]">
          #{c.external_id}
        </span>{" "}
        {c.title}
      </Link>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {c.priority && (
          <span className={`sq sq--on ${PRIORITY_PEN[c.priority]}`}>
            {PRIORITY_LABEL[c.priority]}
          </span>
        )}
        {c.effort && (
          <span className={`sq sq--on ${EFFORT_PEN[c.effort]}`}>
            {c.effort}
          </span>
        )}
        <span className="w-20 text-right text-[9px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]">
          {laneName.get(c.lane_id ?? "")?.name}
        </span>
      </span>
    </li>
  );
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <Link
        href={back}
        className="text-xs text-muted-foreground hover:underline"
      >
        ← {data.board.name}
      </Link>
      <h1 className="mt-1 text-[27px] leading-tight">Timeline</h1>
      <p className="text-sm text-muted-foreground">
        {dated.length} cards with a date, {labelled.length} with only a rough
        date, {open.length - dated.length - labelled.length} unscheduled.
      </p>
      {[...byMonth.entries()].map(([k, cards]) => (
        <section key={k} className="mt-6">
          <h2 className="mb-1 flex items-baseline gap-2 border-b border-[var(--border-strong)] pb-1.5 text-[17px]">
            {MONTH.format(new Date(`${k}-01T00:00:00Z`))}{" "}
            <span className="font-mono text-muted-foreground">
              {cards.length}
            </span>
          </h2>
          <ul>{cards.map(row)}</ul>
        </section>
      ))}
      {labelled.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 flex items-baseline gap-2 border-b border-[var(--border-strong)] pb-1.5 text-[17px] text-[var(--color-grey)]">
            Rough dates
          </h2>
          <ul>{labelled.map(row)}</ul>
        </section>
      )}
      {!dated.length && !labelled.length && (
        <p className="mt-6 text-sm text-muted-foreground">
          No dates yet — set a target on a card and it appears here.
        </p>
      )}
    </main>
  );
}
