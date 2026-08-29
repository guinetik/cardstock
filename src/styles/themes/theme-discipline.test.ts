import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const PAPER = readFileSync(join(here, "paper.css"), "utf8");
const PAPER_NIGHT = readFileSync(join(here, "paper-night.css"), "utf8");
const COMPONENTS = readFileSync(join(here, "../components/paper.css"), "utf8");

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
  const day = declaredTokens(PAPER);
  const night = declaredTokens(PAPER_NIGHT);

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

  test("defines every card-color surface in both themes", () => {
    for (const color of [
      "rose",
      "orange",
      "amber",
      "green",
      "cyan",
      "blue",
      "indigo",
      "violet",
      "pink",
    ]) {
      const token = `--surface-card-${color}`;
      expect(PAPER).toContain(token);
      expect(PAPER_NIGHT).toContain(token);
      expect(COMPONENTS).toContain(`.paper-card.card-color--${color}`);
      expect(COMPONENTS).toContain(`var(${token})`);
    }
  });

  test("uses the differentiated light and dark card-color palette", () => {
    const light: Record<string, string> = {
      rose: "#f2c6d0",
      orange: "#f2cfad",
      amber: "#eedb91",
      green: "#c5dfbd",
      cyan: "#bce0df",
      blue: "#c4d8ee",
      indigo: "#ced0ed",
      violet: "#ddc7eb",
      pink: "#edc7df",
    };
    const dark: Record<string, string> = {
      rose: "#6b3945",
      orange: "#6a4530",
      amber: "#625424",
      green: "#315a36",
      cyan: "#2c5960",
      blue: "#345575",
      indigo: "#44496f",
      violet: "#573d6b",
      pink: "#683b5a",
    };
    for (const [name, hex] of Object.entries(light)) {
      expect(PAPER).toContain(`--surface-card-${name}: ${hex};`);
    }
    for (const [name, hex] of Object.entries(dark)) {
      expect(PAPER_NIGHT).toContain(`--surface-card-${name}: ${hex};`);
    }
  });

  test("every color choice has a thick white rim and drop shadow", () => {
    const choiceBlock =
      COMPONENTS.match(/\.card-color-choice\s*\{[^}]*\}/)?.[0] ?? "";
    expect(choiceBlock).toContain("border: 2px solid white");
    expect(choiceBlock).toContain("box-shadow: 0 1px 4px rgb(0 0 0 / 0.32)");
    expect(choiceBlock).not.toContain("border: 1px solid var(--border-input)");
    expect(choiceBlock).not.toContain(
      "box-shadow: inset 0 0 0 1px var(--border-hairline)",
    );
  });

  test("the none swatch is a 1.5rem circle with a clipped solid-red slash", () => {
    const noneBlock =
      COMPONENTS.match(/\.card-color-choice--none\s*\{[^}]*\}/)?.[0] ?? "";
    expect(noneBlock).toContain("width: 1.5rem");
    expect(noneBlock).toContain("height: 1.5rem");
    expect(noneBlock).toContain("position: relative");
    expect(noneBlock).toContain("overflow: hidden");
    expect(noneBlock).not.toContain("width: auto");
    expect(noneBlock).not.toContain("min-width");
    expect(noneBlock).not.toContain("padding-inline");
    expect(noneBlock).not.toContain("font-size");
    expect(COMPONENTS).toContain(".card-color-choice--none::after");
    const slashBlock =
      COMPONENTS.match(/\.card-color-choice--none::after\s*\{[^}]*\}/)?.[0] ??
      "";
    expect(slashBlock).toContain("height: 0.125rem");
    expect(slashBlock).toContain("border-radius: 999px");
    expect(slashBlock).toContain("background: var(--pen-red)");
    expect(slashBlock).not.toContain("color-mix");
  });

  test("no theme reintroduces glass: no blur, no translucent stock", () => {
    for (const src of [PAPER, PAPER_NIGHT]) {
      expect(src).not.toContain("backdrop-filter");
      expect(src).not.toContain("blur(");
      expect(src).toMatch(/--surface-card:\s*#[0-9a-f]{6};/);
      expect(src).toMatch(/--surface-panel:\s*#[0-9a-f]{6};/);
    }
  });

  test("paper is cut, not moulded", () => {
    for (const src of [PAPER, PAPER_NIGHT]) {
      expect(src).toContain("--radius-card: 2px");
      expect(src).toContain("--radius-btn: 2px");
      expect(src).toContain("--radius-input: 2px");
    }
  });
});

describe("paper components", () => {
  const css = COMPONENTS;

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
    const statBlocks = css.match(/\.stat[^{]*\{[^}]*\}/g) ?? [];
    for (const block of statBlocks) {
      expect(block).not.toContain("border-radius: 999px");
    }
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

  test("the roster is wide binders on the folder stock", () => {
    expect(css).toContain(".roster");
    expect(css).toContain(".roster-slip");
    expect(css).toContain(".roster-you");
    expect(css).not.toContain(".roster-punch");
  });

  test("the project page is a letterhead and section folders", () => {
    expect(css).toContain(".letterhead");
    expect(css).toContain(".folder--section");
    expect(css).not.toContain(".folder--open");
    expect(css).not.toContain(".section-head");
    expect(css).toContain(
      ".folder:not(.folder--section):has(.folder-tab:is(:hover, :focus-visible))",
    );
  });

  test("board binders chart lanes as a miniature board", () => {
    expect(css).toContain(".lane-map");
    expect(css).toContain(".lane-map-col");
    expect(css).toContain(".lane-map-pack");
    expect(css).toContain("flex-wrap: nowrap");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(css).toContain('[data-kind="inbox"]');
    expect(css).toContain(".lane-map-cell");
    expect(css).toContain(".lane-map-cell--vacant");
    expect(css).toContain("overflow: visible");
    expect(css).toContain("bottom: calc(100% + 4px)");
    expect(css).toContain(".lane-map-cell--queued");
    expect(css).toContain(".lane-map-cell--blocked");
    expect(css).toContain(".lane-map-col .lane-map-cell.card-color--rose");
    expect(css).not.toContain('[data-kind="work"] .lane-map-cell');
    expect(css).not.toContain("overflow-x: auto");
    expect(css).not.toContain(".lane-map-col--work");
    expect(css).not.toContain(".lane-map-row");
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
