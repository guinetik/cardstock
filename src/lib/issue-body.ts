export type IssueComment = {
  at: string;
  author: string;
  text: string;
};

const FENCE = /^## Comments\s*$/;
const HEADING = /^### (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (.+)$/;
const QUOTE = /^>(?: |$)/;

/**
 * UTC wall time floored to the minute, as stored in comment headings.
 *
 * @param d - Instant to format; defaults to now.
 */
export function formatCommentAt(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function quoteLines(text: string): string[] {
  const lines = text.split("\n");
  if (!lines.length) return [">"];
  return lines.map((ln) => (ln === "" ? ">" : `> ${ln}`));
}

function unquoteLines(lines: string[]): string {
  return lines.map((ln) => ln.replace(/^> ?/, "")).join("\n");
}

function skipBlanks(lines: string[], i: number): number {
  while (i < lines.length && !lines[i].trim()) i++;
  return i;
}

/**
 * Split a card body into the issue markdown, parsed comments, and any unparsed tail.
 * The comments fence is the last line matching `## Comments`.
 *
 * @param md - `cards.body_md` (no tracker H1).
 */
export function splitIssueBody(md: string): {
  body: string;
  comments: IssueComment[];
  leftover: string;
} {
  const lines = md.split(/\r?\n/);
  let fence = -1;
  for (let i = 0; i < lines.length; i++) if (FENCE.test(lines[i])) fence = i;
  if (fence < 0)
    return { body: md.replace(/\s+$/, ""), comments: [], leftover: "" };

  const body = lines.slice(0, fence).join("\n").replace(/\s+$/, "");
  const suffix = lines.slice(fence + 1);
  const comments: IssueComment[] = [];
  let i = skipBlanks(suffix, 0);

  while (i < suffix.length) {
    const m = HEADING.exec(suffix[i]);
    if (!m) break;
    const start = i;
    i = skipBlanks(suffix, i + 1);
    if (i >= suffix.length || !QUOTE.test(suffix[i])) {
      i = start;
      break;
    }
    const quoted: string[] = [];
    while (i < suffix.length && QUOTE.test(suffix[i])) {
      quoted.push(suffix[i]);
      i++;
    }
    comments.push({ at: m[1], author: m[2], text: unquoteLines(quoted) });
    i = skipBlanks(suffix, i);
  }

  const leftover = suffix
    .slice(i)
    .join("\n")
    .replace(/^\s+/, "")
    .replace(/\s+$/, "");
  return { body, comments, leftover };
}

/**
 * Join an issue body with comments (and an optional unparsed tail) into `body_md`.
 * Omits `## Comments` when both comments and leftover are empty.
 *
 * @param body - Issue markdown, no fence.
 * @param comments - Well-formed comments in time order.
 * @param leftover - Unparsed tail from `splitIssueBody`; default empty.
 */
export function joinIssueBody(
  body: string,
  comments: IssueComment[],
  leftover = "",
): string {
  const head = body.replace(/\s+$/, "");
  if (!comments.length && !leftover) return head;
  const parts: string[] = [head, "", "## Comments"];
  for (const c of comments) {
    parts.push("", `### ${c.at} · ${c.author}`, "", ...quoteLines(c.text));
  }
  if (leftover) parts.push("", leftover.replace(/\s+$/, ""));
  return parts.join("\n");
}
