import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function contractTokens(src: string): Set<string> {
  return new Set(
    [...src.matchAll(/^\s*\*\s*(--[a-z0-9-]+)\s*$/gm)].map((m) => m[1]!),
  );
}

function declaredTokens(src: string): Set<string> {
  return new Set([...src.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]!));
}

function missing(need: Set<string>, have: Set<string>): string[] {
  return [...need].filter((t) => !have.has(t)).sort();
}

function extra(need: Set<string>, have: Set<string>): string[] {
  return [...have].filter((t) => !need.has(t)).sort();
}

describe("theme parity", () => {
  const contract = contractTokens(
    readFileSync(join(here, "tokens.css"), "utf8"),
  );
  const day = declaredTokens(readFileSync(join(here, "paper.css"), "utf8"));
  const night = declaredTokens(
    readFileSync(join(here, "paper-night.css"), "utf8"),
  );

  test("tokens.css lists at least one required token", () => {
    expect(contract.size).toBeGreaterThan(20);
  });

  test("paper.css answers every contract token and no extras", () => {
    expect(missing(contract, day)).toEqual([]);
    expect(extra(contract, day)).toEqual([]);
  });

  test("paper-night.css answers every contract token and no extras", () => {
    expect(missing(contract, night)).toEqual([]);
    expect(extra(contract, night)).toEqual([]);
  });

  test("both themes declare the same token set", () => {
    expect([...day].sort()).toEqual([...night].sort());
  });

  test("no theme reintroduces glass: no blur, no translucent stock", () => {
    for (const src of [
      readFileSync(join(here, "paper.css"), "utf8"),
      readFileSync(join(here, "paper-night.css"), "utf8"),
    ]) {
      expect(src).not.toContain("backdrop-filter");
      expect(src).not.toContain("blur(");
      expect(src).toMatch(/--surface-card:\s*#[0-9a-f]{6};/);
      expect(src).toMatch(/--surface-panel:\s*#[0-9a-f]{6};/);
    }
  });

  test("paper is cut, not moulded", () => {
    for (const src of [
      readFileSync(join(here, "paper.css"), "utf8"),
      readFileSync(join(here, "paper-night.css"), "utf8"),
    ]) {
      expect(src).toContain("--radius-card: 2px");
      expect(src).toContain("--radius-btn: 2px");
      expect(src).toContain("--radius-input: 2px");
    }
  });
});

describe("paper components", () => {
  const css = readFileSync(join(here, "../components/paper.css"), "utf8");

  test("defines the semantic surfaces", () => {
    expect(css).toContain(".paper-card");
    expect(css).toContain(".paper-card--overlay");
    expect(css).toContain(".paper-card--static");
    expect(css).toContain(".paper-lane");
    expect(css).toContain(".paper-lane--drawer");
    expect(css).toContain(".paper-topbar");
    expect(css).toContain("var(--surface-card)");
    expect(css).toContain("var(--surface-panel)");
  });

  test("a lane has stock of its own, so an empty one is still a place", () => {
    expect(css).toMatch(
      /\.paper-lane\s*\{[^}]*background:\s*var\(--surface-panel\)/,
    );
    expect(css).toMatch(
      /\.paper-lane--drawer\s*\{[^}]*background:\s*var\(--surface-well\)/,
    );
  });

  test("status is pen in the margin, not a filled pill", () => {
    expect(css).toContain(".stat--wip");
    expect(css).toContain(".stat--blocked");
    expect(css).toContain("var(--pen-amber)");
    expect(css).not.toContain("border-radius: 999px");
  });

  test("tags are highlighter marks, with an unmarked rest state", () => {
    expect(css).toContain(".mark");
    expect(css).toContain(".mark--off");
    expect(css).toContain("mix-blend-mode: var(--mark-blend)");
    expect(css).toContain("--mark: var(--mark-1)");
    expect(css).toContain("--mark: var(--mark-5)");
  });

  test("the two decisions are pen-filled squares", () => {
    expect(css).toContain(".sq--on");
    expect(css).toContain("--sq: var(--pen-red)");
    expect(css).toContain("color: var(--pen-ink)");
  });

  test("page-scale sheets opt out of the hover lift", () => {
    expect(css).toContain(".paper-card--static:is(:hover, :focus-within)");
  });

  test("dialogs drop the frosted overlay", () => {
    expect(css).toContain('[data-slot="dialog-overlay"]');
    expect(css).toContain("backdrop-filter: none");
  });

  test("prose remaps Tailwind typography vars onto paper ink", () => {
    expect(css).toContain(".prose");
    expect(css).toContain("--tw-prose-body: var(--color-ink2)");
    expect(css).toContain("--tw-prose-headings: var(--color-ink-strong)");
    expect(css).toContain("--tw-prose-links: var(--pen-blue)");
  });

  test("in-page links use pen blue", () => {
    expect(css).toContain(".paper-link");
    expect(css).toContain("color: var(--pen-blue)");
  });
});

describe("card detail page chrome", () => {
  const page = readFileSync(
    join(here, "../../app/p/[project]/b/[board]/c/[externalId]/card-sheet.tsx"),
    "utf8",
  );

  test("does not rely on dormant dark:prose-invert", () => {
    expect(page).not.toContain("dark:prose-invert");
    expect(page).toContain("paper-card--static");
  });

  test("related cards are pen links, not bare ink", () => {
    expect(page).toContain("paper-link");
  });
});

describe("card editor chrome", () => {
  const editor = readFileSync(
    join(
      here,
      "../../app/p/[project]/b/[board]/c/[externalId]/card-editor.tsx",
    ),
    "utf8",
  );

  test("tags are marks in their group's colour, not text-primary", () => {
    expect(editor).toContain("mark--");
    expect(editor).not.toContain("text-primary");
    expect(editor).not.toContain("paper-lane");
  });

  test("tag catalog stays collapsed until Edit tags", () => {
    expect(editor).toContain("Edit tags");
    expect(editor).toContain("editingTags");
  });
});

describe("board card density", () => {
  const item = readFileSync(
    join(here, "../../components/board/card-item.tsx"),
    "utf8",
  );

  test("tactician fields live in the hover peek, not the resting chrome", () => {
    expect(item).toContain("card-peek");
    expect(item.indexOf("card-peek")).toBeLessThan(item.indexOf("<Ratings"));
    expect(item.indexOf("card-peek")).toBeLessThan(
      item.indexOf('aria-label="Card fields"'),
    );
  });

  test("the resting summary steps aside when the peek opens", () => {
    expect(item).toContain('className="card-rest');
    expect(item.indexOf('className="card-rest')).toBeLessThan(
      item.indexOf('<div className="card-peek">'),
    );
  });
});
