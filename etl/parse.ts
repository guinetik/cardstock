/**
 * Lenient frontmatter + body parsing for tracker files.
 *
 * Mirrors the reference tracker's own frontmatter parser: `key: value`,
 * inline lists `[a, b]`, block lists of `- item`, quoted scalars unquoted.
 * Deliberately not a YAML parser — the tracker never was, and titles with
 * colons or quotes must keep working.
 */
import { createHash } from "node:crypto";

export interface ParsedFile {
  frontmatter: Record<string, unknown>;
  body: string;
  hash: string;
}

const QUOTED = /^(["'])(.*)\1$/s;

export function dequote(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const m = QUOTED.exec(v);
  return m ? m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : v;
}

export function parseFile(text: string): ParsedFile {
  const lines = text.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== "---")
    throw new Error("file does not open with a --- frontmatter fence");
  let end = -1;
  for (let i = 1; i < lines.length; i++)
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  if (end < 0) throw new Error("frontmatter fence is never closed");

  const data: Record<string, unknown> = {};
  let key: string | null = null;
  for (const raw of lines.slice(1, end)) {
    const s = raw.trim();
    if (!s) continue;
    if (s.startsWith("- ") && key) {
      if (!Array.isArray(data[key])) data[key] = [];
      (data[key] as unknown[]).push(dequote(s.slice(2).trim()));
      continue;
    }
    const idx = raw.indexOf(":");
    if (idx < 0) continue;
    key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((v) => dequote(v.trim()))
        .filter((v) => v !== "");
    } else if (value === "") {
      data[key] = [];
    } else {
      data[key] = dequote(value);
    }
  }
  const body = lines.slice(end + 1).join("\n");
  return {
    frontmatter: data,
    body,
    hash: createHash("sha256").update(text).digest("hex"),
  };
}

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const EMPHASIS = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g;

/** First paragraph under `## Ask`, as plain text — the card summary seed. */
export function extractAsk(body: string): string {
  const m = /^## Ask\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(body);
  if (!m) return "";
  const section = m[1].trim();
  if (!section) return "";
  const paragraph = section.split(/\n\s*\n/)[0];
  const text = paragraph
    .split("\n")
    .map((ln) => ln.replace(/^\s*>\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(WIKILINK, (_m, target: string, label?: string) => label ?? target)
    .replace(
      EMPHASIS,
      (_m, a?: string, b?: string, c?: string) => a ?? b ?? c ?? "",
    );
  return text.replace(/\s+/g, " ").trim();
}

/** Strip the H1 the tracker repeats from the title. */
export function bodyWithoutH1(body: string): string {
  return body.replace(/^\s*# .*\n?/, "").trim();
}
