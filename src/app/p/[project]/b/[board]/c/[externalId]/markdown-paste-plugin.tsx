"use client";

import { useEffect } from "react";
import {
  addComposerChild$,
  insertMarkdown$,
  realmPlugin,
  rootEditor$,
  useCellValue,
  usePublisher,
} from "@mdxeditor/editor";
import { COMMAND_PRIORITY_HIGH, PASTE_COMMAND } from "lexical";

// Matches headings, list items, blockquotes, code fences, tables, bold/italic,
// links, or inline code — enough to tell "pasted markdown" from "pasted prose".
const MARKDOWN_HINT =
  /(^|\n)[ \t]{0,3}(#{1,6}[ \t]|[-*+][ \t]|\d+\.[ \t]|>[ \t]|```|\|.*\|)|(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\))/;

// Tags that indicate the clipboard HTML carries real formatting (i.e. it was
// copied out of a rich editor), as opposed to being a plain-text app's inert
// HTML wrapper (VS Code, Notepad, a raw-source view) around markdown source.
const SEMANTIC_HTML_TAG = /<\/?(h[1-6]|ul|ol|li|blockquote|pre|code|strong|b|em|i|a|table)\b/i;

function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_HINT.test(text);
}

function htmlHasRealFormatting(html: string): boolean {
  return SEMANTIC_HTML_TAG.test(html);
}

/**
 * MDXEditor only runs its markdown importer on the initial `markdown` prop.
 * A plain-text paste (e.g. copied from another markdown file) is otherwise
 * inserted as literal characters instead of being parsed, so pasted
 * `## Heading` stays literal text rather than becoming a heading node.
 */
function MarkdownPasteHandler() {
  const editor = useCellValue(rootEditor$);
  const insertMarkdown = usePublisher(insertMarkdown$);

  useEffect(() => {
    if (!editor) return;
    return editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent) || !event.clipboardData) return false;
        const text = event.clipboardData.getData("text/plain");
        if (!text || !looksLikeMarkdown(text)) return false;
        // If the HTML clipboard entry carries real formatting, it's a rich
        // paste (copied out of a web page or another WYSIWYG editor) — let
        // the default handler convert that HTML instead of the plain text.
        const html = event.clipboardData.getData("text/html");
        if (html && htmlHasRealFormatting(html)) return false;
        event.preventDefault();
        insertMarkdown(text);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, insertMarkdown]);

  return null;
}

export const markdownPastePlugin = realmPlugin({
  init(realm) {
    realm.pubIn({ [addComposerChild$]: MarkdownPasteHandler });
  },
});
