import { Eye } from "lucide-react";
import Link from "next/link";
import type { WatchedCard } from "@/lib/watched-cards";

export function WatchedFolder({ cards }: { cards: WatchedCard[] }) {
  return (
    <li className={`folder${cards.length ? "" : " folder--empty"}`}>
      <Link className="folder-tab" href="/watched">
        <Eye size={15} aria-hidden="true" />
        <span>My watched issues</span>
      </Link>
      <div className="folder-body">
        <p className="folder-blurb">
          The cards you’re keeping an eye on, across your projects.
        </p>
        {cards.length ? (
          <ul
            className="divide-y divide-[var(--border-hairline)]"
            aria-label="My watched issues"
          >
            {cards.slice(0, 5).map((card) => (
              <li key={card.id} className="py-2">
                <Link
                  className="paper-link"
                  href={`/p/${card.boards.projects.slug}/b/${card.boards.slug}/c/${card.external_id}`}
                >
                  <span className="font-mono text-xs">#{card.external_id}</span>{" "}
                  {card.title}
                </Link>
                <p className="mt-1 font-mono text-[10px] text-[var(--color-grey)]">
                  {card.boards.projects.name} / {card.boards.name} ·{" "}
                  {card.archived_at
                    ? "Archived"
                    : (card.lanes?.name ?? card.status)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="binders-empty">
            Use the eye beside a card’s number to file it here.
          </p>
        )}
        <div className="folder-aside">
          <span className="folder-stamp" aria-hidden="true">
            {cards.length} {cards.length === 1 ? "issue" : "issues"}
            <br />
            watched
          </span>
          <Link className="folder-go paper-link" href="/watched">
            Open watched issues →
          </Link>
        </div>
      </div>
    </li>
  );
}
