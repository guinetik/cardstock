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
  const light = declaredTokens(readFileSync(join(here, "glass.css"), "utf8"));
  const dark = declaredTokens(
    readFileSync(join(here, "glass-dark.css"), "utf8"),
  );

  test("tokens.css lists at least one required token", () => {
    expect(contract.size).toBeGreaterThan(20);
  });

  test("glass.css answers every contract token and no extras", () => {
    expect(missing(contract, light)).toEqual([]);
    expect(extra(contract, light)).toEqual([]);
  });

  test("glass-dark.css answers every contract token and no extras", () => {
    expect(missing(contract, dark)).toEqual([]);
    expect(extra(contract, dark)).toEqual([]);
  });

  test("both themes declare the same token set", () => {
    expect([...light].sort()).toEqual([...dark].sort());
  });
});

describe("field and cards CSS", () => {
  const field = readFileSync(join(here, "../components/field.css"), "utf8");
  const cards = readFileSync(join(here, "../components/cards.css"), "utf8");

  test("field is static radials, not keyframes", () => {
    expect(field).toContain("#field");
    expect(field).toContain("radial-gradient");
    expect(field).toContain("var(--field-a)");
    expect(field).toContain("var(--field-b)");
    expect(field).toContain("var(--field-c)");
    expect(field).not.toContain("@keyframes");
  });

  test("cards define the semantic surfaces", () => {
    expect(cards).toContain(".glass-card");
    expect(cards).toContain(".glass-panel");
    expect(cards).toContain(".glass-topbar");
    expect(cards).toContain(".glass-panel--inbox");
    expect(cards).toContain(".chip-status--wip");
    expect(cards).toContain("var(--surface-card)");
  });

  test("prose remaps Tailwind typography vars onto glass ink", () => {
    expect(cards).toContain(".prose");
    expect(cards).toContain("--tw-prose-body: var(--color-ink)");
    expect(cards).toContain("--tw-prose-headings: var(--color-ink-strong)");
    expect(cards).toContain("--tw-prose-links: var(--color-brand)");
  });

  test("page-scale glass cards can opt out of hover lift", () => {
    expect(cards).toContain(".glass-card--static");
  });

  test("tag chips use ink on the info surface, not brand-as-text", () => {
    expect(cards).toContain(".chip-tag");
    expect(cards).toContain(".chip-tag--on");
    expect(cards).toContain("--color-ink-strong");
    expect(cards).toContain("--fill-chip-info");
  });

  test("in-page links use brand ink", () => {
    expect(cards).toContain(".glass-link");
    expect(cards).toContain("color: var(--color-brand)");
  });
});

describe("card detail page chrome", () => {
  const page = readFileSync(
    join(here, "../../app/p/[project]/b/[board]/c/[externalId]/page.tsx"),
    "utf8",
  );

  test("does not rely on dormant dark:prose-invert", () => {
    expect(page).not.toContain("dark:prose-invert");
    expect(page).toContain("glass-card--static");
  });

  test("related cards are brand links, not bare ink", () => {
    expect(page).toContain("glass-link");
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

  test("selected tags use chip-tag, not text-primary", () => {
    expect(editor).toContain("chip-tag");
    expect(editor).not.toContain("text-primary");
    expect(editor).not.toContain("glass-panel");
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
});
