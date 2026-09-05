import { marked } from "marked";

const CARD_REFERENCE = /(^|[\s([{"'“‘,:;!?—–-])#(\d+)\b/gu;
const HTML_TAG = /<!--[\s\S]*?-->|<\/?([a-z][\w-]*)\b[^>]*>/giu;
const PROTECTED_TAGS = new Set(["a", "code", "pre", "script", "style"]);

export type CardReferencePart =
  | { type: "text"; value: string }
  | { type: "reference"; externalId: string };

/** Split prose into ordinary text and board-local `#123` card references. */
export function cardReferenceParts(text: string): CardReferencePart[] {
  const parts: CardReferencePart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(CARD_REFERENCE)) {
    const index = match.index;
    const prefix = match[1] ?? "";
    const externalId = match[2];
    const referenceStart = index + prefix.length;

    if (referenceStart > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, referenceStart) });
    }
    parts.push({ type: "reference", externalId });
    cursor = referenceStart + externalId.length + 1;
  }

  if (cursor < text.length) {
    parts.push({ type: "text", value: text.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

/** Canonical page URL for a numbered card on a board. */
export function cardReferenceHref(
  boardPath: string,
  externalId: string,
): string {
  return `${boardPath}/c/${externalId}`;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function linkText(text: string, boardPath: string): string {
  return cardReferenceParts(text)
    .map((part) =>
      part.type === "text"
        ? part.value
        : `<a class="paper-link" data-card-reference="${part.externalId}" href="${escapeAttribute(cardReferenceHref(boardPath, part.externalId))}">#${part.externalId}</a>`,
    )
    .join("");
}

/**
 * Add card links to rendered HTML without touching tags, links, or code.
 * Marked has already escaped ordinary text at this point.
 */
export function linkCardReferencesInHtml(
  html: string,
  boardPath: string,
): string {
  let output = "";
  let cursor = 0;
  let protectedDepth = 0;

  for (const match of html.matchAll(HTML_TAG)) {
    const index = match.index;
    const tag = match[0];
    const name = match[1]?.toLowerCase();

    output +=
      protectedDepth === 0
        ? linkText(html.slice(cursor, index), boardPath)
        : html.slice(cursor, index);
    output += tag;

    if (name && PROTECTED_TAGS.has(name)) {
      if (tag.startsWith("</"))
        protectedDepth = Math.max(0, protectedDepth - 1);
      else if (!tag.endsWith("/>")) protectedDepth += 1;
    }
    cursor = index + tag.length;
  }

  output +=
    protectedDepth === 0
      ? linkText(html.slice(cursor), boardPath)
      : html.slice(cursor);
  return output;
}

/** Render card Markdown and autolink board-local numbered references. */
export function renderCardMarkdown(
  markdown: string,
  boardPath: string,
): string {
  const html = marked.parse(markdown, { async: false, gfm: true }) as string;
  return linkCardReferencesInHtml(html, boardPath);
}
