import { marked } from "marked";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import { EFFORT_LABEL, PRIORITY_LABEL } from "@/lib/types";
import { CardEditor } from "./card-editor";

export const dynamic = "force-dynamic";

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Card detail: metadata, editor, and markdown body for one board card.
 *
 * @param props - Next.js page props for `/p/[project]/b/[board]/c/[externalId]`.
 */
export default async function CardPage(
  props: PageProps<"/p/[project]/b/[board]/c/[externalId]">,
) {
  const { project, board, externalId } = await props.params;
  const me = await currentMember();
  if (!me) redirect("/login?error=member");
  const db = await supabaseServer();
  const { data: b } = await db
    .from("boards")
    .select("id, slug, name, settings, projects!inner(slug, name)")
    .eq("slug", board)
    .eq("projects.slug", project)
    .maybeSingle();
  if (!b) notFound();
  const { data: card } = await db
    .from("cards")
    .select("*")
    .eq("board_id", b.id)
    .eq("external_id", externalId)
    .maybeSingle();
  if (!card) notFound();
  const [
    { data: lanes },
    { data: groups },
    { data: tags },
    { data: links },
    { data: events },
  ] = await Promise.all([
    db
      .from("lanes")
      .select("id, key, name, kind")
      .eq("board_id", b.id)
      .order("position"),
    db
      .from("tag_groups")
      .select("id, key, name, tags(id, key, name)")
      .eq("board_id", b.id)
      .order("position"),
    db.from("card_tags").select("tag_id").eq("card_id", card.id),
    db
      .from("card_links")
      .select(
        "kind, to_card, cards!card_links_to_card_fkey(external_id, title)",
      )
      .eq("from_card", card.id),
    db
      .from("card_events")
      .select("id, actor, kind, payload, at")
      .eq("card_id", card.id)
      .order("at", { ascending: false })
      .limit(50),
  ]);
  const lane = (lanes ?? []).find((l) => l.id === card.lane_id);
  const html = marked.parse(
    card.body_md.replace(
      WIKILINK,
      (_m: string, t: string, l?: string) => `**${l ?? t}**`,
    ),
    { async: false, gfm: true },
  ) as string;
  const backHref = `/p/${project}/b/${board}`;

  return (
    <main className="glass-card glass-card--static mx-auto w-full max-w-4xl p-6">
      <Link
        href={backHref}
        className="text-xs text-muted-foreground hover:underline"
      >
        ← {b.name}
      </Link>
      <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight">
        #{card.external_id} {card.title}
      </h1>
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="chip-status chip-status--muted">{card.status}</span>
        {lane && (
          <span className="chip-status chip-status--info">{lane.name}</span>
        )}
        {card.needs && (
          <span className="chip-status chip-status--attention">
            needs {card.needs}
          </span>
        )}
        {card.priority && (
          <span className="chip-status chip-status--muted">
            {PRIORITY_LABEL[card.priority as 1 | 2 | 3]}
          </span>
        )}
        {card.effort && (
          <span className="chip-status chip-status--muted">
            Difficulty {EFFORT_LABEL[card.effort as "L" | "M" | "H"]}
          </span>
        )}
        {card.archived_at && (
          <span className="chip-status chip-status--muted">
            archived by {card.archived_by}
          </span>
        )}
      </div>

      <CardEditor
        card={{
          id: card.id,
          summary: card.summary,
          priority: card.priority,
          effort: card.effort,
          target_date: card.target_date,
          target_label: card.target_label,
          audience: card.audience,
          archived_at: card.archived_at,
          external_id: card.external_id,
        }}
        groups={
          (groups ?? []) as unknown as {
            id: string;
            name: string;
            tags: { id: string; name: string }[];
          }[]
        }
        tagIds={(tags ?? []).map((t) => t.tag_id)}
        backHref={backHref}
        priorityLabel={
          (b.settings as { priority_label?: string } | null)?.priority_label ??
          "Priority"
        }
      />

      <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 border-t border-[var(--border-divider)] pt-5 text-sm">
        <dt className="font-semibold">Epic</dt>
        <dd>{card.epic}</dd>
        <dt className="font-semibold">Area</dt>
        <dd>{card.area}</dd>
        {card.raised_by && (
          <>
            <dt className="font-semibold">Raised</dt>
            <dd>
              {card.raised_by}
              {card.raised_on ? ` · ${card.raised_on}` : ""}
            </dd>
          </>
        )}
        {card.shipped_on && (
          <>
            <dt className="font-semibold">Shipped</dt>
            <dd>{card.shipped_on}</dd>
          </>
        )}
        {!!links?.length && (
          <>
            <dt className="font-semibold">Related</dt>
            <dd className="flex flex-wrap gap-2">
              {links.map((l) => {
                const t = l.cards as unknown as {
                  external_id: string;
                  title: string;
                } | null;
                return t ? (
                  <Link
                    key={`${l.kind}-${l.to_card}`}
                    href={`/p/${project}/b/${board}/c/${t.external_id}`}
                    className="glass-link"
                    title={t.title}
                  >
                    #{t.external_id}
                    {l.kind === "blocked_by" ? " (blocks)" : ""}
                  </Link>
                ) : null;
              })}
            </dd>
          </>
        )}
        {Object.keys(card.frontmatter_extra ?? {}).length > 0 && (
          <>
            <dt className="font-semibold">Extra</dt>
            <dd className="font-mono text-xs">
              {JSON.stringify(card.frontmatter_extra)}
            </dd>
          </>
        )}
      </dl>

      <article
        className="prose prose-sm mt-6 max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          History
        </h2>
        <ul className="space-y-1 text-xs">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="font-mono text-muted-foreground">
                {new Date(e.at).toISOString().slice(0, 16).replace("T", " ")}
              </span>
              <span className="font-semibold">{e.kind}</span>
              <span className="text-muted-foreground">{e.actor}</span>
              <span className="truncate font-mono text-muted-foreground">
                {JSON.stringify(e.payload)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
