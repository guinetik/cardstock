/**
 * Write the app-owned keys back into a tracker file's frontmatter, touching nothing else.
 *
 * The tracker's frontmatter is line-oriented (see parse.ts), so this is a line edit, not a
 * YAML re-serialisation: every other line, comment, quoting choice and the body stay byte-identical.
 * Managed keys are removed wherever they were and re-appended as a block at the end of the
 * frontmatter (after any trailing `- item` list), in a fixed order.
 */

export const MANAGED_KEYS = [
  "lane",
  "rank",
  "priority",
  "effort",
  "planned_start",
  "target",
  "archived",
  "archived_by",
  "color",
] as const;
export type ManagedKey = (typeof MANAGED_KEYS)[number];
export type Managed = Partial<
  Record<ManagedKey, string | number | null | undefined>
>;

export interface NewCardMarkdown {
  externalId: string;
  title: string;
  status: string;
  epic: string;
  area: string;
  tags: string[];
  summary?: string | null;
  bodyMd?: string | null;
  managed: Managed;
}

const KEY_LINE = /^([A-Za-z_][\w-]*):/;

export function writeManaged(text: string, managed: Managed): string {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---")
    throw new Error("file does not open with a --- frontmatter fence");
  let end = -1;
  for (let i = 1; i < lines.length; i++)
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  if (end < 0) throw new Error("frontmatter fence is never closed");

  // Drop existing managed keys (and any `- item` continuation lines that belonged to them).
  const kept: string[] = [];
  let dropping = false;
  for (const raw of lines.slice(1, end)) {
    const m = KEY_LINE.exec(raw);
    if (m) {
      dropping = (MANAGED_KEYS as readonly string[]).includes(m[1]);
      if (dropping) continue;
    } else if (dropping && raw.trim().startsWith("- ")) continue;
    else dropping = false;
    kept.push(raw);
  }
  // Trim trailing blank lines inside the frontmatter so the block sits tight.
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();

  const block: string[] = [];
  for (const k of MANAGED_KEYS) {
    const v = managed[k];
    if (v === null || v === undefined || v === "") continue;
    block.push(`${k}: ${formatScalar(v)}`);
  }
  const out = ["---", ...kept, ...block, "---", ...lines.slice(end + 1)];
  return out.join(nl);
}

/** Quote only when the tracker's lenient parser would otherwise misread the value. */
export function formatScalar(v: string | number): string {
  if (typeof v === "number")
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
  const s = String(v);
  if (/^[\w./:@ -]*$/.test(s) && !s.startsWith("[") && !s.includes(": "))
    return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Build the complete tracker file for a card first created in the app. */
export function createNewCardMarkdown(card: NewCardMarkdown): string {
  const tags = [...new Set(["tracker-item", ...card.tags])];
  const frontmatter = [
    "---",
    `id: ${formatScalar(card.externalId)}`,
    `title: ${formatScalar(card.title)}`,
    `status: ${formatScalar(card.status)}`,
    `epic: ${formatScalar(card.epic || "Unassigned")}`,
    `area: ${formatScalar(card.area || "general")}`,
    "tags:",
    ...tags.map((tag) => `  - ${formatScalar(tag)}`),
    ...(card.summary ? [`summary: ${formatScalar(card.summary)}`] : []),
    "---",
    `# #${card.externalId} — ${card.title}`,
    "",
    card.bodyMd?.replace(/(\r?\n)+$/, "") ?? "",
  ].join("\n");
  return `${writeManaged(frontmatter, card.managed).replace(/(\r?\n)+$/, "")}\n`;
}

/**
 * Replace everything after the closing frontmatter fence with the tracker H1
 * plus `bodyMd`. Used only when the app owns the body (`body_edited_at` set).
 *
 * @param text - Full file (frontmatter + old body).
 * @param externalId - Tracker id, used in `# #n — title`.
 * @param title - Card title.
 * @param bodyMd - `cards.body_md` (no H1).
 */
export function writeBody(
  text: string,
  externalId: string,
  title: string,
  bodyMd: string,
): string {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---")
    throw new Error("file does not open with a --- frontmatter fence");
  let end = -1;
  for (let i = 1; i < lines.length; i++)
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  if (end < 0) throw new Error("frontmatter fence is never closed");
  const body = bodyMd.replace(/\r?\n/g, nl).replace(/(\r?\n)+$/, "");
  const h1 = `# #${externalId} — ${title}`;
  const out = [...lines.slice(0, end + 1), h1, "", body].join(nl);
  return out.endsWith(nl) ? out : `${out}${nl}`;
}
