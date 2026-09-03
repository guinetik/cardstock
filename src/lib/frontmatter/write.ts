/**
 * Writing a sheet back out.
 *
 * `writeSheet` is a line edit: it takes the file that was handed to us and
 * rewrites only the keys whose value the board disagrees with, in place.
 * Every other byte — quoting, order, comments, unknown keys, the body — is
 * left alone. `cardToMarkdown` builds a file from nothing, for a card that
 * never had one.
 */
import { bodyWithoutH1, parseFile } from "./parse";
import { validateFrontmatter } from "./schema";
import {
  type CardSheet,
  SHEET_KEY_ORDER,
  SHEET_KEYS,
  type SheetKey,
  sheetFromFrontmatter,
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

/**
 * Where a key with no line yet belongs: right after its nearest schema
 * neighbour that the file states, or right before the next one that does.
 * `null` when the file states none of them — the caller appends at the end.
 */
function insertionPoint(lines: string[], key: SheetKey): number | null {
  const idx = SHEET_KEY_ORDER.indexOf(key);
  for (let i = idx - 1; i >= 0; i--) {
    const at = locate(lines, SHEET_KEY_ORDER[i]);
    if (at) return at.end;
  }
  for (let i = idx + 1; i < SHEET_KEY_ORDER.length; i++) {
    const at = locate(lines, SHEET_KEY_ORDER[i]);
    if (at) return at.start;
  }
  return null;
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
  const parsed = parseFile(sourceText);
  const srcBody = body.join("\n");
  const tagRef = opts.tagRef ?? ((t: string) => t);

  // The file's own view of each key, read through the very normaliser the
  // import reads it through — otherwise a free-text `raised: TBD`, a
  // lower-case `effort: m` or a `value:` standing in for `priority:` looks
  // like a disagreement and an untouched line gets rewritten or deleted.
  const { data: fileFm, extra: fileExtra } = validateFrontmatter(
    parsed.frontmatter,
  );
  const fileTags = fileFm.tags;
  const fileSheet = sheetFromFrontmatter(
    fileFm,
    fileExtra,
    srcBody,
    fileTags.map((t) => tagRef(t) ?? t),
  );
  const have = (key: SheetKey): Value =>
    SHEET_KEYS[key].get(fileSheet) as Value;

  let lines = [...fm];
  const append: string[] = [];
  for (const key of SHEET_KEY_ORDER) {
    let want = SHEET_KEYS[key].get(sheet) as Value;
    if (key === "relates") {
      // The file owns its relations. The board can only hold links to cards
      // it has, so a relation to an item outside the board (or one an import
      // never carried) must not vanish on the way down: the board may add
      // to the list, never take from it.
      const mine = (have(key) as number[]) ?? [];
      const theirs = (want as number[]) ?? [];
      want = [...mine, ...theirs.filter((n) => !mine.includes(n))];
    }
    if (norm(want) === norm(have(key))) continue;
    const at = locate(lines, key);
    if (at) {
      let replacement: string[];
      if (
        key !== "tags" &&
        Array.isArray(want) &&
        at.end === at.start + 1 &&
        /^[^:]+:\s*\[/.test(lines[at.start])
      ) {
        // An inline `key: [a, b]` stays inline.
        replacement = want.length
          ? [`${key}: [${want.map(formatScalar).join(", ")}]`]
          : [];
      } else if (key === "tags") {
        // keep the file's own lines for tags that survive, append the new refs
        const wanted = new Set((want as string[]) ?? []);
        const block = lines.slice(at.start + 1, at.end);
        const kept: string[] = [];
        fileTags.forEach((t, i) => {
          // A tag the resolver has no opinion on (no board tag claims it)
          // is not ours to remove — only a tag we recognise, and that this
          // card no longer wants, drops out.
          const ref = tagRef(t);
          if (ref != null && !wanted.has(ref)) return;
          // An inline `tags: [a, b]` has no lines of its own; write them out.
          kept.push(block[i] ?? `${at.indent}- ${formatScalar(t)}`);
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
    } else {
      const newLines = fileLines(key, want, "  ");
      const pos = insertionPoint(lines, key);
      if (pos == null) append.push(...newLines);
      else lines.splice(pos, 0, ...newLines);
    }
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  lines = [...lines, ...append];

  // Body: untouched, appended to, or replaced — in that order of preference.
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
