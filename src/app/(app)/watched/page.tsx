import { Eye, Folder } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CardWatchButton } from "@/components/card-watch-button";
import { currentMember } from "@/lib/supabase/server";
import { loadWatchedCards } from "@/lib/watched-cards";

export const metadata: Metadata = { title: "My watched issues" };

export default async function WatchedPage() {
  if (!(await currentMember())) redirect("/login?error=member");
  const cards = await loadWatchedCards();
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[var(--color-grey)]"
      >
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 hover:underline"
        >
          <Folder size={13} aria-hidden="true" />
          Projects
        </Link>
        <span aria-hidden="true">/</span>
        <span
          aria-current="page"
          className="inline-flex items-center gap-1.5 text-[var(--color-ink)]"
        >
          <Eye size={13} aria-hidden="true" />
          My watched issues
        </span>
      </nav>
      <header className="letterhead">
        <div>
          <h1>My watched issues</h1>
          <p className="folder-blurb">
            Your personal collection, across every project you can access.
          </p>
        </div>
        <span className="font-mono text-xs">{cards.length} watched</span>
      </header>
      {cards.length ? (
        <ul
          className="mt-6 divide-y divide-[var(--border-hairline)] border-y border-[var(--border-strong)]"
          aria-label="Watched issues"
        >
          {cards.map((card) => (
            <li key={card.id} className="flex items-start gap-3 py-4">
              <CardWatchButton
                cardId={card.id}
                externalId={card.external_id}
                watching
              />
              <div className="min-w-0 flex-1">
                <Link
                  className="break-words text-xl hover:underline"
                  href={`/p/${card.boards.projects.slug}/b/${card.boards.slug}/c/${card.external_id}`}
                >
                  <span className="font-mono text-xs">#{card.external_id}</span>{" "}
                  {card.title}
                </Link>
                <p className="mt-1 font-mono text-[11px] text-[var(--color-grey)]">
                  {card.boards.projects.name} / {card.boards.name} ·{" "}
                  {card.archived_at
                    ? "Archived"
                    : (card.lanes?.name ?? card.status)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="folder-blurb mt-6">
          Nothing watched yet. Use the eye beside a card’s number on a board to
          add it here.
        </p>
      )}
    </main>
  );
}
