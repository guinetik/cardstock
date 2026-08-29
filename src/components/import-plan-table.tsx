import type { Plan, PlanRow } from "@/lib/import/types";

const VERDICT: Record<PlanRow["verdict"], string> = {
  new: "stat stat--success",
  changed: "stat stat--wip",
  unchanged: "stat",
  error: "stat stat--blocked",
};

function Side({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <details className="plan-side">
      <summary className="stat">
        {items.length} {label}
      </summary>
      <ul>
        {items.map((i) => (
          <li key={i} className="font-mono text-[11px]">
            {i}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ImportPlanTable({ plan }: { plan: Plan }) {
  return (
    <div className="plan">
      <div className="plan-sides">
        <Side
          label="lanes to create"
          items={plan.newLanes.map((l) => `${l.key} — ${l.name}`)}
        />
        <Side
          label="tag groups to create"
          items={plan.newGroups.map((g) => g.key)}
        />
        <Side
          label="tags to create"
          items={plan.newTags.map((t) => `${t.groupKey}:${t.key}`)}
        />
        <Side
          label="tags not applied"
          items={plan.unappliedTags.map(
            (t) => `${t.tag} — ${t.cards.length} card(s)`,
          )}
        />
        <Side
          label="ambiguous tags"
          items={plan.ambiguousTags.map(
            (t) => `${t.tag} — ${t.cards.length} card(s)`,
          )}
        />
      </div>
      <div className="plan-scroll">
        <table className="plan-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Verdict</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.id} data-testid={`plan-row-${r.id}`}>
                <td className="font-mono">{r.id}</td>
                <td>{r.title ?? ""}</td>
                <td>
                  <span className={VERDICT[r.verdict]}>{r.verdict}</span>
                </td>
                <td className="plan-changes">
                  {r.verdict === "error" && (
                    <span className="text-[var(--pen-red)]">{r.message}</span>
                  )}
                  {r.verdict === "new" && (
                    <span className="font-mono text-[11px]">→ {r.lane}</span>
                  )}
                  {r.verdict === "changed" &&
                    r.changes.map((c) => (
                      <span
                        key={c.key}
                        className="plan-chip font-mono text-[11px]"
                      >
                        {c.key === "body"
                          ? "body"
                          : `${c.key}: ${c.from ?? "—"} → ${c.to ?? "—"}`}
                      </span>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p
        className="plan-counts font-mono text-[11px]"
        data-testid="plan-counts"
      >
        {plan.counts.new} new · {plan.counts.changed} changed ·{" "}
        {plan.counts.unchanged} unchanged
        {plan.counts.error ? ` · ${plan.counts.error} error(s)` : ""}
      </p>
    </div>
  );
}
