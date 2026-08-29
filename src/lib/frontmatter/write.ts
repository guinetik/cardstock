/**
 * Writing a sheet back out.
 *
 * `writeSheet` is a line edit: it takes the file that was handed to us and
 * rewrites only the keys whose value the board disagrees with, in place.
 * Every other byte — quoting, order, comments, unknown keys, the body — is
 * left alone. `cardToMarkdown` builds a file from nothing, for a card that
 * never had one.
 */
import { bodyWithoutH1, dequote, extractAsk, parseFile } from "./parse";
import {
  type CardSheet,
  SHEET_KEY_ORDER,
  SHEET_KEYS,
  type SheetKey,
} from "./sheet";

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

/** Quote only when the tracker's lenient parser would otherwise misread the value. */
export function formatScalar(v: string | number): string {
  if (typeof v === "number")
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
  const s = String(v);
  if (/^[\w./:@ -]*$/.test(s) && !s.startsWith("[") && !s.includes(": "))
    return s;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

const KEY_LINE = /^([A-Za-z_][\w-]*):/;

type Value = string | number | null | (string | number)[];

function fileLines(key: string, value: Value, indent: string): string[] {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    if (!value.length) return [];
    return [`${key}:`, ...value.map((v) => `${indent}- ${formatScalar(v)}`)];
  }
  return [`${key}: ${formatScalar(value)}`];
}

/** Where `key` sits in the frontmatter: its line and any `- item` lines under it. */
function locate(
  fm: string[],
  key: string,
): { start: number; end: number; indent: string } | null {
  for (let i = 0; i < fm.length; i++) {
    const m = KEY_LINE.exec(fm[i]);
    if (!m || m[1] !== key) continue;
    let end = i + 1;
    let indent = "  ";
    while (end < fm.length && fm[end].trim().startsWith("- ")) {
      indent = fm[end].slice(0, fm[end].indexOf("-"));
      end++;
    }
    return { start: i, end, indent };
  }
  return null;
}

function norm(v: Value): string | null {
  if (v == null || v === "") return null;
  if (Array.isArray(v))
    return v
      .map(String)
      .map((s) => s.trim())
      .sort()
      .join(",");
  return String(v).trim();
}

/** Split a file into frontmatter lines (between the fences), the fence index, and the body lines. */
function split(text: string) {
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
  return { nl, fm: lines.slice(1, end), body: lines.slice(end + 1) };
}

/**
 * The file as it was handed to us, with the board's marks written in.
 *
 * @param sourceText - The stored sheet (`cards.source_text`).
 * @param sheet - The card as the board has it now.
 * @param opts.tagRef - Resolve a bare tag in the file to a board ref, so `bug` and `kind:bug` compare equal.
 */
export function writeSheet(
  sourceText: string,
  sheet: CardSheet,
  opts: { tagRef?: (tag: string) => string | null } = {},
): string {
  const { nl, fm, body } = split(sourceText);
  const parsed = parseFile(sourceText).frontmatter;
  const tagRef = opts.tagRef ?? ((t: string) => t);

  // The file's own view of each key, normalised the way the sheet is.
  const have = (key: SheetKey): Value => {
    const raw = parsed[key];
    if (key === "tags")
      return ((raw as string[] | undefined) ?? []).map((t) => tagRef(t) ?? t);
    if (key === "summary" && raw == null)
      return extractAsk(body.join("\n")) || null;
    if (key === "priority" && raw == null && parsed.value != null) {
      const v = String(parsed.value).trim().toUpperCase()[0];
      return v === "H" ? 1 : v === "M" ? 2 : v === "L" ? 3 : null;
    }
    if (Array.isArray(raw)) return raw.map((x) => String(dequote(x)));
    return raw == null ? null : (dequote(raw) as string);
  };

  let lines = [...fm];
  const append: string[] = [];
  for (const key of SHEET_KEY_ORDER) {
    const want = SHEET_KEYS[key].get(sheet) as Value;
    if (norm(want) === norm(have(key))) continue;
    const at = locate(lines, key);
    if (at) {
      let replacement: string[];
      if (key === "tags") {
        // keep the file's own lines for tags that survive, append the new refs
        const fileTags = (parsed.tags as string[] | undefined) ?? [];
        const wanted = new Set((want as string[]) ?? []);
        const kept = lines.slice(at.start + 1, at.end).filter((_ln, i) => {
          const t = fileTags[i];
          return t != null && wanted.has(tagRef(t) ?? t);
        });
        const keptRefs = new Set(
          fileTags.map((t) => tagRef(t) ?? t).filter((r) => wanted.has(r)),
        );
        const added = ((want as string[]) ?? []).filter(
          (r) => !keptRefs.has(r),
        );
        replacement =
          kept.length + added.length
            ? [
                `${key}:`,
                ...kept,
                ...added.map((r) => `${at.indent}- ${formatScalar(r)}`),
              ]
            : [];
      } else replacement = fileLines(key, want, at.indent);
      lines.splice(at.start, at.end - at.start, ...replacement);
    } else append.push(...fileLines(key, want, "  "));
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  lines = [...lines, ...append];

  // Body: untouched, appended to, or replaced — in that order of preference.
  const srcBody = body.join("\n");
  const base = bodyWithoutH1(srcBody);
  let outBody: string[];
  if (sheet.bodyMd === base) outBody = body;
  else if (base && sheet.bodyMd.startsWith(base)) {
    const tail = sheet.bodyMd.slice(base.length).replace(/^\n+/, "");
    const trimmed = [...body];
    while (trimmed.length && !trimmed[trimmed.length - 1].trim()) trimmed.pop();
    outBody = [...trimmed, "", ...tail.split("\n"), ""];
  } else {
    outBody = [
      `# #${sheet.externalId} — ${sheet.title}`,
      "",
      ...sheet.bodyMd.replace(/\n+$/, "").split("\n"),
      "",
    ];
  }
  const out = ["---", ...lines, "---", ...outBody].join(nl);
  const hadTrailing = /\r?\n$/.test(sourceText);
  return hadTrailing
    ? out.endsWith(nl)
      ? out
      : out + nl
    : out.replace(/(\r?\n)+$/, "");
}

/** A complete file for a card that never had one: schema order, extras, managed keys, H1, body. */
export function cardToMarkdown(sheet: CardSheet): string {
  const lines: string[] = ["---", `id: ${sheet.externalId}`];
  const managed = new Set<string>(MANAGED_KEYS);
  for (const key of SHEET_KEY_ORDER)
    if (!managed.has(key))
      lines.push(...fileLines(key, SHEET_KEYS[key].get(sheet) as Value, "  "));
  for (const [k, v] of Object.entries(sheet.extra))
    lines.push(...fileLines(k, v as Value, "  "));
  for (const key of MANAGED_KEYS)
    lines.push(...fileLines(key, SHEET_KEYS[key].get(sheet) as Value, "  "));
  lines.push(
    "---",
    `# #${sheet.externalId} — ${sheet.title}`,
    "",
    sheet.bodyMd.replace(/\n+$/, ""),
  );
  return `${lines.join("\n")}\n`;
}
