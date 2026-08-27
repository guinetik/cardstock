"use client";
import type { CardPatch } from "@/app/p/[project]/b/[board]/actions";
import type { Card } from "@/lib/types";

const P: Array<1 | 2 | 3> = [1, 2, 3];
const E: Array<"L" | "M" | "H"> = ["L", "M", "H"];
const PRIO_ON: Record<1 | 2 | 3, string> = {
  1: "bg-violet-600 text-white",
  2: "bg-primary text-primary-foreground",
  3: "bg-slate-500 text-white",
};
const EFF_ON: Record<"L" | "M" | "H", string> = {
  L: "bg-emerald-600 text-white",
  M: "bg-amber-500 text-black",
  H: "bg-rose-600 text-white",
};

/** Difficulty (effort L/M/H) and the owner's priority (P1–P3). Click the active one to clear. */
export function Ratings({
  card,
  onPatch,
  priorityLabel = "Priority",
}: {
  card: Card;
  onPatch: (id: string, p: CardPatch) => void;
  priorityLabel?: string;
}) {
  const btn =
    "h-6 min-w-6 rounded-md border px-1.5 font-mono text-[11px] font-bold";
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={`Difficulty for #${card.external_id}`}
      >
        <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Difficulty
        </span>
        {E.map((v) => (
          <button
            key={v}
            type="button"
            data-effort={v}
            className={`${btn} ${card.effort === v ? EFF_ON[v] : "bg-background text-muted-foreground"}`}
            onClick={() =>
              onPatch(card.id, { effort: card.effort === v ? null : v })
            }
            title={{ L: "Low", M: "Medium", H: "High" }[v]}
          >
            {v}
          </button>
        ))}
      </div>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={`${priorityLabel} for #${card.external_id}`}
      >
        <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {priorityLabel}
        </span>
        {P.map((v) => (
          <button
            key={v}
            type="button"
            data-priority={v}
            className={`${btn} ${card.priority === v ? PRIO_ON[v] : "bg-background text-muted-foreground"}`}
            onClick={() =>
              onPatch(card.id, { priority: card.priority === v ? null : v })
            }
            title={`Priority ${v}`}
          >
            P{v}
          </button>
        ))}
      </div>
    </div>
  );
}
