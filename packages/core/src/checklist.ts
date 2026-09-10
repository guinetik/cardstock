/** Portable checklist data. Database identities deliberately stay out of Markdown. */
export interface ChecklistItem {
  label: string;
  completed: boolean;
}

export interface ChecklistSection {
  present: boolean;
  items: ChecklistItem[];
}

export interface ParsedChecklist extends ChecklistSection {
  body: string;
  start: number;
  end: number;
}

/** Find only document-level headings, ignoring fenced code and quoted examples. */
function headings(markdown: string) {
  const found: { level: number; title: string; start: number; end: number }[] =
    [];
  let offset = 0;
  let fence: { char: string; length: number } | null = null;
  for (const raw of markdown.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const line = raw.replace(/\r?\n$/, "");
    const code = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (
        code &&
        code[1][0] === fence.char &&
        code[1].length >= fence.length &&
        !code[2].trim()
      )
        fence = null;
    } else if (code) {
      fence = { char: code[1][0], length: code[1].length };
    } else {
      const heading = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
      if (heading)
        found.push({
          level: heading[1].length,
          title: heading[2],
          start: offset,
          end: offset + raw.length,
        });
    }
    offset += raw.length;
  }
  return found;
}

export function parseChecklist(
  markdown: string,
  { allowUnbulletedItems = false }: { allowUnbulletedItems?: boolean } = {},
): ParsedChecklist {
  const all = headings(markdown);
  const sections = all.filter(
    (h) => h.level === 2 && h.title.toLowerCase() === "checklist",
  );
  if (sections.length > 1)
    throw new Error("Use one ## Checklist section per card.");
  const heading = sections[0];
  if (!heading)
    return { present: false, items: [], body: markdown, start: -1, end: -1 };
  const end =
    all.find((h) => h.start > heading.start && h.level <= 2)?.start ??
    markdown.length;
  const items: ChecklistItem[] = [];
  for (const line of markdown.slice(heading.end, end).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const item =
      /^[-*+] \[([ xX])\][ \t]+(.+?)\s*$/.exec(line) ??
      (allowUnbulletedItems ? /^\[([ xX])\][ \t]+(.+?)\s*$/.exec(line) : null);
    if (!item || !item[2].trim())
      throw new Error(
        "Checklist must be a flat checklist with non-empty labels; move notes and nested items outside ## Checklist.",
      );
    items.push({
      label: item[2].trim(),
      completed: item[1].toLowerCase() === "x",
    });
  }
  return {
    present: true,
    items,
    body: markdown.slice(0, heading.start) + markdown.slice(end),
    start: heading.start,
    end,
  };
}

export function checklistSection(
  value: Pick<ChecklistSection, "present" | "items">,
): ChecklistSection {
  return {
    present: value.present,
    items: value.items.map(({ label, completed }) => ({ label, completed })),
  };
}

export function sameChecklist(
  a: ChecklistSection,
  b: ChecklistSection,
): boolean {
  return (
    JSON.stringify(checklistSection(a)) === JSON.stringify(checklistSection(b))
  );
}

/** Edit the reserved section only. Keep its exact bytes when its meaning is unchanged. */
export function writeChecklist(
  markdown: string,
  section: ChecklistSection,
): string {
  const parsed = parseChecklist(markdown);
  if (sameChecklist(parsed, section)) return markdown;
  if (!section.present) return parsed.body;
  const nl = markdown.includes("\r\n") ? "\r\n" : "\n";
  const block = [
    "## Checklist",
    ...section.items.map((i) => `- [${i.completed ? "x" : " "}] ${i.label}`),
  ].join(nl);
  if (parsed.present) {
    const tail = markdown.slice(parsed.end);
    const original = markdown.slice(parsed.start, parsed.end);
    const trailing = /(?:\r?\n)*$/.exec(original)?.[0] ?? "";
    return (
      markdown.slice(0, parsed.start) +
      block +
      (tail ? nl + nl : trailing) +
      tail
    );
  }
  const comments = headings(markdown).find(
    (h) => h.level === 2 && h.title === "Comments",
  );
  const at = comments?.start ?? markdown.length;
  const before = markdown.slice(0, at);
  const after = markdown.slice(at);
  return (
    before +
    (before && !before.endsWith(nl + nl)
      ? before.endsWith(nl)
        ? nl
        : nl + nl
      : "") +
    block +
    (after ? nl + nl + after : nl)
  );
}

/** Retain the original location, anchored by the following heading after body edits. */
export function composeChecklist(
  body: string,
  section: ChecklistSection,
  sourceBody?: string,
): string {
  if (parseChecklist(body).present) return writeChecklist(body, section);
  if (
    sourceBody !== undefined &&
    parseChecklist(sourceBody).body.trim() === body.trim()
  )
    return writeChecklist(sourceBody, section);
  if (sourceBody !== undefined && section.present) {
    const original = parseChecklist(sourceBody);
    const following = original.present
      ? headings(sourceBody).find((h) => h.start >= original.end)
      : undefined;
    const anchor = following
      ? headings(body).find(
          (h) => h.level === following.level && h.title === following.title,
        )
      : undefined;
    if (anchor) {
      const nl = body.includes("\r\n") ? "\r\n" : "\n";
      return writeChecklist(
        body.slice(0, anchor.start) +
          `## Checklist${nl}${nl}` +
          body.slice(anchor.start),
        section,
      );
    }
  }
  return writeChecklist(body, section);
}
