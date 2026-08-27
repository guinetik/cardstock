"use client";
import type { CardPatch } from "@/app/p/[project]/b/[board]/actions";
import { type Card, EFFORT_PEN, PRIORITY_PEN } from "@/lib/types";

const P: Array<1 | 2 | 3> = [1, 2, 3];
const E: Array<"L" | "M" | "H"> = ["L", "M", "H"];

const EFFORT_TITLE = { L: "Low", M: "Medium", H: "High" } as const;

/**
 * Effort (L/M/H) and priority (P1–P3) on one row of the card's form: how hard
 * on the left, how soon on the right. Click the active square to clear it.
 */
export function Ratings({
  card,
  onPatch,
}: {
  card: Card;
  onPatch: (id: string, p: CardPatch) => void;
}) {
  return (
    <>
      <span className="field-label">Effort</span>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={`Effort for #${card.external_id}`}
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
      </div>
      <span className="field-label">Priority</span>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={`Priority for #${card.external_id}`}
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
              title={`Priority ${v}`}
            >
              P{v}
            </button>
          );
        })}
      </div>
    </>
  );
}
