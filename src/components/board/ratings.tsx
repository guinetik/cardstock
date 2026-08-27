"use client";
import type { CardPatch } from "@/app/p/[project]/b/[board]/actions";
import { type Card, EFFORT_PEN, PRIORITY_PEN } from "@/lib/types";

const P: Array<1 | 2 | 3> = [1, 2, 3];
const E: Array<"L" | "M" | "H"> = ["L", "M", "H"];

const EFFORT_TITLE = { L: "Low", M: "Medium", H: "High" } as const;

/**
 * Difficulty (effort L/M/H) and the owner's priority (P1–P3), as two rows of
 * the card's form: a label in the margin, the squares in the body. Click the
 * active one to clear it.
 */
export function Ratings({
  card,
  onPatch,
  priorityLabel = "Priority",
}: {
  card: Card;
  onPatch: (id: string, p: CardPatch) => void;
  priorityLabel?: string;
}) {
  return (
    <>
      <span className="field-label">Diff</span>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={`Difficulty for #${card.external_id}`}
      >
        {E.map((v) => {
          const on = card.effort === v;
          return (
            <button
              key={v}
              type="button"
              data-effort={v}
              data-on={on}
              className={`sq ${on ? `sq--on ${EFFORT_PEN[v]}` : ""}`}
              onClick={() => onPatch(card.id, { effort: on ? null : v })}
              title={EFFORT_TITLE[v]}
            >
              {v}
            </button>
          );
        })}
        <span className="ml-1 text-[11px] text-[var(--color-grey-faint)]">
          {card.effort ? EFFORT_TITLE[card.effort] : "how hard"}
        </span>
      </div>

      <span className="field-label">{priorityLabel}</span>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={`${priorityLabel} for #${card.external_id}`}
      >
        {P.map((v) => {
          const on = card.priority === v;
          return (
            <button
              key={v}
              type="button"
              data-priority={v}
              data-on={on}
              className={`sq ${on ? `sq--on ${PRIORITY_PEN[v]}` : ""}`}
              onClick={() => onPatch(card.id, { priority: on ? null : v })}
              title={`${priorityLabel} ${v}`}
            >
              P{v}
            </button>
          );
        })}
        <span className="ml-1 text-[11px] text-[var(--color-grey-faint)]">
          {card.priority ? "" : "how soon"}
        </span>
      </div>
    </>
  );
}
