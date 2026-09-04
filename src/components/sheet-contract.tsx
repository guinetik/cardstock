import { jsonSchema } from "@/lib/frontmatter/schema";
import { cardToMarkdown, MANAGED_KEYS } from "@/lib/frontmatter/write";

/**
 * What a sheet must look like, read off the schema so it cannot drift.
 * Required keys, then the optional ones, then the keys the board writes.
 */
const SAMPLE = cardToMarkdown({
  externalId: "42",
  title: "Should trials require a credit card?",
  status: "backlog",
  epic: "Billing",
  area: "Product",
  assignee: "ana@x.test",
  tags: ["kind:question"],
  raisedBy: "Ana",
  raisedOn: "2026-08-07",
  shippedOn: null,
  needs: null,
  summary: null,
  relates: [],
  lane: "next",
  rank: 1,
  priority: 2,
  effort: "M",
  plannedStart: null,
  target: "2026-10-01",
  archived: null,
  archivedBy: null,
  color: null,
  extra: {},
  bodyMd: "## Ask\n\nAna asked after reviewing the billing flow.",
});

export function SheetContract() {
  const s = jsonSchema() as {
    properties: Record<string, { enum?: string[]; type?: string }>;
    required?: string[];
  };
  const required = new Set(s.required ?? []);
  const managed = new Set<string>(MANAGED_KEYS);
  const keys = Object.keys(s.properties);
  const line = (k: string) => {
    const p = s.properties[k];
    return p.enum ? p.enum.join(" | ") : (p.type ?? "text");
  };
  return (
    <aside className="contract" aria-label="Sheet contract">
      <p className="contract-lede">
        A sheet is a markdown file: frontmatter between <code>---</code> fences,
        the body below. Keys the schema does not know are kept verbatim.
      </p>
      <details className="contract-fold">
        <summary>How a sheet is written</summary>
        <dl className="contract-keys">
          {keys
            .filter((k) => required.has(k))
            .map((k) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  {line(k)} <span className="stat stat--blocked">required</span>
                </dd>
              </div>
            ))}
          {keys
            .filter((k) => !required.has(k) && !managed.has(k))
            .map((k) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{line(k)}</dd>
              </div>
            ))}
          {keys
            .filter((k) => managed.has(k))
            .map((k) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  {line(k)}{" "}
                  <span className="stat stat--info">written by the board</span>
                </dd>
              </div>
            ))}
        </dl>
        <pre className="contract-sample">
          <code>{SAMPLE}</code>
        </pre>
      </details>
    </aside>
  );
}
