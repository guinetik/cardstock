import Link from "next/link";
import { redirect } from "next/navigation";
import { loadBoard } from "@/lib/board-data";
import { currentMember } from "@/lib/supabase/server";
import { PRIORITY_LABEL } from "@/lib/types";

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
  const row = (c: (typeof open)[number]) => (
    <li
      key={c.id}
      className="glass-card flex items-baseline gap-3 px-3 py-2 text-sm"
    >
      <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
        {c.target_date ?? c.target_label}
      </span>
      <Link
        href={`${back}/c/${c.external_id}`}
        className="font-medium hover:underline"
      >
        #{c.external_id} {c.title}
      </Link>
      <span className="ml-auto flex shrink-0 gap-1 text-[10px] uppercase text-muted-foreground">
        {c.priority && (
          <span className="rounded-full border px-1.5">
            {PRIORITY_LABEL[c.priority]}
          </span>
        )}
        {c.effort && (
          <span className="rounded-full border px-1.5">{c.effort}</span>
        )}
        <span className="rounded-full border px-1.5">
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
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Timeline</h1>
      <p className="text-sm text-muted-foreground">
        {dated.length} cards with a date, {labelled.length} with only a rough
        date, {open.length - dated.length - labelled.length} unscheduled.
      </p>
      {[...byMonth.entries()].map(([k, cards]) => (
        <section key={k} className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">
            {MONTH.format(new Date(`${k}-01T00:00:00Z`))}{" "}
            <span className="font-mono text-muted-foreground">
              {cards.length}
            </span>
          </h2>
          <ul className="space-y-1.5">{cards.map(row)}</ul>
        </section>
      ))}
      {labelled.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Rough dates
          </h2>
          <ul className="space-y-1.5">{labelled.map(row)}</ul>
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
