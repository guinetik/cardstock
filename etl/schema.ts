/**
 * Frontmatter contract between a markdown tracker and the app.
 *
 * Required keys are the minimum a tracker must carry;
 * known optional keys are typed; every other key is preserved verbatim in
 * `cards.frontmatter_extra` and round-trips on export.
 */
import { z } from "zod";

export const STATUSES = [
  "backlog",
  "blocked",
  "wip",
  "held",
  "built",
  "handed",
  "shipped",
  "done",
] as const;
export type Status = (typeof STATUSES)[number];

const lmh = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase().slice(0, 1) : v),
  z.enum(["L", "M", "H"]).nullable().optional(),
);
// Date-ish keys are free text in the wild ("TBD", two dates, a note); the ISO form is what reaches the DB.
const dateish = z.preprocess(
  (v) => (Array.isArray(v) ? v.join(", ") : v),
  z.string().nullable().optional(),
);
export const isoOrNull = (v: unknown): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())
    ? v.trim()
    : null;
const intList = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? v
          .map((x) => Number(String(x).trim()))
          .filter((n) => Number.isInteger(n))
      : [],
  z.array(z.number().int()),
);
const strList = z.preprocess(
  (v) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : []),
  z.array(z.string()),
);

export const frontmatterSchema = z.looseObject({
  id: z.coerce.number().int().positive(),
  title: z.string().min(1),
  status: z.enum(STATUSES),
  epic: z.string().min(1),
  area: z.string().min(1),
  tags: strList.refine((t) => t.includes("tracker-item"), {
    message: "tags must include tracker-item",
  }),
  // known optional
  value: lmh,
  effort: lmh,
  raised_by: z.string().nullable().optional(),
  raised: dateish,
  reconfirmed: dateish,
  shipped: dateish,
  merged: dateish,
  target: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  spec: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
  relates: intList.optional(),
  needs: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  technical_title: z.string().nullable().optional(),
  archived: z.string().nullable().optional(),
  archived_by: z.string().nullable().optional(),
  // the app's own round-trip keys
  lane: z.string().nullable().optional(),
  rank: z.coerce.number().nullable().optional(),
  priority: z.coerce.number().int().min(1).max(3).nullable().optional(),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;

export const KNOWN_KEYS = new Set(Object.keys(frontmatterSchema.shape));

/** Validate raw frontmatter; returns the typed record plus the unknown keys as `extra`. */
export function validateFrontmatter(
  raw: Record<string, unknown>,
  file = "<frontmatter>",
) {
  const result = frontmatterSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`${file}: ${issues}`);
  }
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw))
    if (!KNOWN_KEYS.has(k)) extra[k] = v;
  return { data: result.data, extra };
}

/** JSON Schema for docs/frontmatter.schema.json (`bun run etl:schema`). */
export function jsonSchema() {
  return z.toJSONSchema(frontmatterSchema, { target: "draft-2020-12" });
}
