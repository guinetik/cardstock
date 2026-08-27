# Glass Skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skin cardstock with the designer’s light glass tokens, a dark-glass sibling, a static radial field, and a localStorage theme toggle.

**Architecture:** CSS token contract (`glass` / `glass-dark` on `<html data-theme>`). JS only resolves and applies the theme. shadcn primitives consume remapped variables; board chrome uses `.glass-card` / `.glass-panel` / `.glass-topbar`. No aurora, no `.dark` class, no behaviour changes to drag/filters/ETL/auth.

**Tech Stack:** Next.js 16.3 App Router · React 19 · Tailwind 4 · shadcn 4 · bun 1.4 `bun test` · Playwright · lucide-react (Sun/Moon).

**Spec:** `docs/superpowers/specs/2026-08-27-glass-skin-design.md`

## Global Constraints

- Storage key is `localStorage.theme`; stored values are `"light"` | `"dark"` only.
- Resolved theme names are `"glass"` | `"glass-dark"`; never add a `.dark` class.
- Fonts: drop Geist; `--font-sys` is `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`; `--font-mono` is `ui-monospace, "SFMono-Regular", monospace`.
- Field is three **static** `radial-gradient`s on `#field`. No `@keyframes`, no aurora blobs.
- Do not port rail/catalog/SAP/VT/`btn-cta` CSS. Keep shadcn `Button`.
- Keep `data-id` and `data-lane` attributes unchanged (Playwright).
- JSDoc on every exported function (match `src/lib/lanes.ts`).
- Run tests with `bun test <file>` and e2e with `bun run test:e2e`.
- Commit messages: `feat: …` / `fix: …` / `chore: …`, short.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/theme.ts` | `THEME_STORAGE_KEY`, `ThemeName`, `resolveTheme`, `applyTheme`, `shouldFollowSystem`, `THEME_BOOTSTRAP_SCRIPT` |
| `src/lib/theme.test.ts` | Mapping + apply + bootstrap-string checks |
| `src/styles/themes/tokens.css` | Comment contract listing every per-theme token |
| `src/styles/themes/glass.css` | Light token values |
| `src/styles/themes/glass-dark.css` | Dark token values |
| `src/styles/themes/theme-discipline.test.ts` | Both themes answer the same contract |
| `src/styles/components/field.css` | `#field` static radials |
| `src/styles/components/cards.css` | `.glass-card`, `.glass-panel`, `.glass-topbar`, `.chip-status*` |
| `src/app/globals.css` | Imports, brand tokens, shadcn aliases, drop oklch `.dark` |
| `src/components/theme-toggle.tsx` | Client sun/moon toggle |
| `src/app/layout.tsx` | Bootstrap script, `#field`, chrome, system fonts |
| Board/page components | Swap material classes only |

Brand tokens (`--color-brand`, `--color-ok`, `--color-red`, …) live in `globals.css` `@theme`, not in the per-theme files.

---

### Task 1: Theme mapping library

**Files:**
- Create: `src/lib/theme.ts`
- Test: `src/lib/theme.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `THEME_STORAGE_KEY = "theme"`; `type ThemeName = "glass" | "glass-dark"`; `type ThemeRoot = { dataset: { theme?: string }; style: { colorScheme: string }; setAttribute(name: string, value: string): void }`; `resolveTheme(stored: string | null, prefersDark: boolean): ThemeName`; `applyTheme(theme: ThemeName, root: ThemeRoot): void`; `shouldFollowSystem(stored: string | null): boolean`; `THEME_BOOTSTRAP_SCRIPT: string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/theme.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  applyTheme,
  resolveTheme,
  shouldFollowSystem,
  type ThemeRoot,
} from "./theme";

describe("resolveTheme", () => {
  test("stored light always wins", () => {
    expect(resolveTheme("light", true)).toBe("glass");
    expect(resolveTheme("light", false)).toBe("glass");
  });

  test("stored dark always wins", () => {
    expect(resolveTheme("dark", true)).toBe("glass-dark");
    expect(resolveTheme("dark", false)).toBe("glass-dark");
  });

  test("null and garbage follow the OS", () => {
    expect(resolveTheme(null, true)).toBe("glass-dark");
    expect(resolveTheme(null, false)).toBe("glass");
    expect(resolveTheme("system", true)).toBe("glass-dark");
    expect(resolveTheme("", false)).toBe("glass");
  });
});

describe("shouldFollowSystem", () => {
  test("only an explicit light/dark choice stops following", () => {
    expect(shouldFollowSystem("light")).toBe(false);
    expect(shouldFollowSystem("dark")).toBe(false);
    expect(shouldFollowSystem(null)).toBe(true);
    expect(shouldFollowSystem("nope")).toBe(true);
  });
});

describe("applyTheme", () => {
  test("sets data-theme and color-scheme on the root", () => {
    const attrs: Record<string, string> = {};
    const root: ThemeRoot = {
      dataset: {},
      style: { colorScheme: "" },
      setAttribute(name, value) {
        attrs[name] = value;
      },
    };
    applyTheme("glass-dark", root);
    expect(root.dataset.theme).toBe("glass-dark");
    expect(root.style.colorScheme).toBe("dark");
    expect(attrs["data-theme"]).toBe("glass-dark");
    expect(attrs["color-scheme"]).toBe("dark");
    applyTheme("glass", root);
    expect(root.dataset.theme).toBe("glass");
    expect(root.style.colorScheme).toBe("light");
  });
});

describe("THEME_BOOTSTRAP_SCRIPT", () => {
  test("inlines the same storage key and resolve rules", () => {
    expect(THEME_STORAGE_KEY).toBe("theme");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('localStorage.getItem("theme")');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('stored === "light"');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('stored === "dark"');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("data-theme");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/theme.test.ts`

Expected: FAIL — `Cannot find module './theme'` (or `resolveTheme` is not exported).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/theme.ts`:

```ts
export const THEME_STORAGE_KEY = "theme";

export type ThemeName = "glass" | "glass-dark";

export type ThemeRoot = {
  dataset: { theme?: string };
  style: { colorScheme: string };
  setAttribute: (name: string, value: string) => void;
};

/**
 * Map a stored preference and the OS colour scheme to a data-theme value.
 * Only `"light"` and `"dark"` in storage count; anything else follows the OS.
 */
export function resolveTheme(
  stored: string | null,
  prefersDark: boolean,
): ThemeName {
  if (stored === "light") return "glass";
  if (stored === "dark") return "glass-dark";
  return prefersDark ? "glass-dark" : "glass";
}

/**
 * True when the OS colour scheme should still drive the theme.
 */
export function shouldFollowSystem(stored: string | null): boolean {
  return stored !== "light" && stored !== "dark";
}

/**
 * Write `data-theme` and `color-scheme` onto the document root (or a test double).
 */
export function applyTheme(theme: ThemeName, root: ThemeRoot): void {
  const scheme = theme === "glass-dark" ? "dark" : "light";
  root.dataset.theme = theme;
  root.style.colorScheme = scheme;
  root.setAttribute("data-theme", theme);
  root.setAttribute("color-scheme", scheme);
}

/**
 * Blocking inline script for the root layout. Keep in sync with `resolveTheme`.
 * Runs in the browser with no module loader; layout injects this string as-is.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var stored = null;
    try { stored = localStorage.getItem("theme"); } catch (e) {}
    var prefersDark = false;
    try { prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) {}
    var theme = stored === "light" ? "glass" : stored === "dark" ? "glass-dark" : prefersDark ? "glass-dark" : "glass";
    var root = document.documentElement;
    var scheme = theme === "glass-dark" ? "dark" : "light";
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = scheme;
    root.setAttribute("color-scheme", scheme);
  } catch (e) {}
})();`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/theme.test.ts`

Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme.ts src/lib/theme.test.ts
git commit -m "feat: add glass theme mapping"
```

---

### Task 2: Token contract CSS

**Files:**
- Create: `src/styles/themes/tokens.css`
- Create: `src/styles/themes/glass.css`
- Create: `src/styles/themes/glass-dark.css`
- Test: `src/styles/themes/theme-discipline.test.ts`

**Interfaces:**
- Consumes: token names and values from the spec’s “Token contract” tables (per-theme only; not brand)
- Produces: `:root[data-theme='glass']` and `:root[data-theme='glass-dark']` custom properties listed in `tokens.css`

- [ ] **Step 1: Write the failing test**

Create `src/styles/themes/theme-discipline.test.ts`:

```ts
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
  return new Set(
    [...src.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]!),
  );
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/styles/themes/theme-discipline.test.ts`

Expected: FAIL — `ENOENT` for `tokens.css` / `glass.css` / `glass-dark.css`.

- [ ] **Step 3: Write the three CSS files**

Create `src/styles/themes/tokens.css` with this exact comment list (the test parses `* --name` lines):

```css
/*
 * Per-theme token contract. glass.css and glass-dark.css must declare
 * every name below. Brand tokens live in globals.css @theme, not here.
 *
 * --color-bg
 * --color-card
 * --color-fill
 * --color-sep
 * --color-ink
 * --color-ink2
 * --color-grey
 * --color-grey3
 * --color-ink-strong
 * --color-grey-soft
 * --color-grey-faint
 * --color-grey-faintest
 * --color-grey-badge
 * --color-scrollbar
 * --surface-page
 * --surface-card
 * --surface-card-sunken
 * --surface-input
 * --surface-raised
 * --surface-topbar
 * --surface-panel
 * --surface-warn
 * --surface-info
 * --surface-danger
 * --surface-success
 * --surface-attention
 * --border-hairline
 * --border-strong
 * --border-input
 * --border-panel
 * --border-divider
 * --border-focus-soft
 * --border-warn
 * --border-danger-soft
 * --border-success-soft
 * --border-attention-soft
 * --fill-subtle
 * --fill-badge
 * --fill-subtle-strong
 * --fill-track
 * --fill-chip-info
 * --shadow-card
 * --shadow-card-sm
 * --shadow-modal
 * --shadow-inset-hi
 * --shadow-panel
 * --shadow-check
 * --scrim
 * --radius-input
 * --radius-btn
 * --radius-card
 * --radius-opt
 * --radius-banner
 * --radius-modal
 * --blur-card
 * --blur-card-saturate
 * --blur-topbar
 * --field-a
 * --field-b
 * --field-c
 * --display-weight
 * --display-tracking
 * --motion-duration-press
 * --motion-duration-hover
 * --motion-duration-ui
 * --motion-duration-stage
 * --motion-duration-reveal
 * --motion-ease-out
 * --motion-ease-in-out
 * --motion-ease-springy
 * --motion-distance-sm
 * --motion-scale-press
 * --motion-lift-hover
 */
```

Create `src/styles/themes/glass.css` (light values from the spec):

```css
:root[data-theme="glass"] {
  --color-bg: #e9e9ed;
  --color-card: rgb(255 255 255 / 0.52);
  --color-fill: rgb(255 255 255 / 0.34);
  --color-sep: rgb(255 255 255 / 0.7);
  --color-ink: #1e2740;
  --color-ink2: #3a4560;
  --color-grey: #5e6a88;
  --color-grey3: #a6b0c8;
  --color-ink-strong: #2a2e3a;
  --color-grey-soft: #5c6376;
  --color-grey-faint: #8890a6;
  --color-grey-faintest: #b9c0d0;
  --color-grey-badge: #6e7488;
  --color-scrollbar: rgb(100 116 139 / 0.5);
  --surface-page: #eef2fa;
  --surface-card: rgb(255 255 255 / 0.52);
  --surface-card-sunken: rgb(255 255 255 / 0.34);
  --surface-input: rgb(255 255 255 / 0.66);
  --surface-raised: rgb(255 255 255 / 0.8);
  --surface-topbar: rgb(255 255 255 / 0.58);
  --surface-panel: rgb(255 255 255 / 0.34);
  --surface-warn: rgb(255 243 221 / 0.75);
  --surface-info: rgb(239 245 254 / 0.7);
  --surface-danger: rgb(253 235 235 / 0.75);
  --surface-success: rgb(227 247 232 / 0.75);
  --surface-attention: rgb(253 246 234 / 0.75);
  --border-hairline: rgb(255 255 255 / 0.7);
  --border-strong: rgb(255 255 255 / 0.85);
  --border-input: rgb(255 255 255 / 0.85);
  --border-panel: rgb(255 255 255 / 0.55);
  --border-divider: rgb(40 56 100 / 0.16);
  --border-focus-soft: rgb(207 224 246 / 0.9);
  --border-warn: rgb(240 168 40 / 0.5);
  --border-danger-soft: rgb(243 199 199 / 0.85);
  --border-success-soft: rgb(189 235 200 / 0.85);
  --border-attention-soft: rgb(243 211 160 / 0.85);
  --fill-subtle: rgb(120 130 160 / 0.12);
  --fill-badge: rgb(120 130 160 / 0.14);
  --fill-subtle-strong: rgb(120 130 170 / 0.18);
  --fill-track: rgb(196 203 219 / 0.8);
  --fill-chip-info: rgb(238 244 254 / 0.8);
  --shadow-card:
    0 10px 30px rgb(30 50 120 / 0.13), 0 0 0 1px rgb(255 255 255 / 0.4),
    inset 0 1px 0 rgb(255 255 255 / 0.85);
  --shadow-card-sm:
    0 10px 30px rgb(30 50 120 / 0.13), 0 0 0 1px rgb(255 255 255 / 0.4),
    inset 0 1px 0 rgb(255 255 255 / 0.85);
  --shadow-modal: 0 34px 80px -14px rgb(20 25 60 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.9);
  --shadow-inset-hi: inset 0 1px 0 rgb(255 255 255 / 0.7);
  --shadow-panel: 0 18px 50px rgb(30 50 120 / 0.1), inset 0 1px 0 rgb(255 255 255 / 0.6);
  --shadow-check: 0 2px 6px rgb(52 199 89 / 0.4);
  --scrim: rgb(18 22 42 / 0.3);
  --radius-input: 11px;
  --radius-btn: 13px;
  --radius-card: 18px;
  --radius-opt: 12px;
  --radius-banner: 14px;
  --radius-modal: 24px;
  --blur-card: 24px;
  --blur-card-saturate: 165%;
  --blur-topbar: 30px;
  --field-a: rgb(58 128 255 / 0.44);
  --field-b: rgb(104 176 255 / 0.3);
  --field-c: rgb(122 100 240 / 0.14);
  --display-weight: 600;
  --display-tracking: -0.005em;
  --motion-duration-press: 120ms;
  --motion-duration-hover: 220ms;
  --motion-duration-ui: 280ms;
  --motion-duration-stage: 380ms;
  --motion-duration-reveal: 560ms;
  --motion-ease-out: cubic-bezier(0.32, 0.72, 0, 1);
  --motion-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --motion-ease-springy: cubic-bezier(0.34, 1.3, 0.64, 1);
  --motion-distance-sm: 6px;
  --motion-scale-press: 0.985;
  --motion-lift-hover: -1px;
}
```

Create `src/styles/themes/glass-dark.css` (dark values from the spec; radii/blur/display/motion copied from light):

```css
:root[data-theme="glass-dark"] {
  --color-bg: #101624;
  --color-card: rgb(255 255 255 / 0.09);
  --color-fill: rgb(255 255 255 / 0.05);
  --color-sep: rgb(255 255 255 / 0.18);
  --color-ink: #e8ecf7;
  --color-ink2: #c5cce0;
  --color-grey: #8b95b0;
  --color-grey3: #5a6480;
  --color-ink-strong: #f3f5fb;
  --color-grey-soft: #9aa3bb;
  --color-grey-faint: #7a849c;
  --color-grey-faintest: #5c6680;
  --color-grey-badge: #8b95b0;
  --color-scrollbar: rgb(148 163 184 / 0.45);
  --surface-page: #101624;
  --surface-card: rgb(255 255 255 / 0.09);
  --surface-card-sunken: rgb(255 255 255 / 0.05);
  --surface-input: rgb(255 255 255 / 0.12);
  --surface-raised: rgb(255 255 255 / 0.16);
  --surface-topbar: rgb(16 22 40 / 0.65);
  --surface-panel: rgb(255 255 255 / 0.05);
  --surface-warn: rgb(255 243 221 / 0.14);
  --surface-info: rgb(239 245 254 / 0.12);
  --surface-danger: rgb(253 235 235 / 0.14);
  --surface-success: rgb(227 247 232 / 0.12);
  --surface-attention: rgb(253 246 234 / 0.14);
  --border-hairline: rgb(255 255 255 / 0.18);
  --border-strong: rgb(255 255 255 / 0.28);
  --border-input: rgb(255 255 255 / 0.28);
  --border-panel: rgb(255 255 255 / 0.12);
  --border-divider: rgb(180 200 255 / 0.14);
  --border-focus-soft: rgb(79 140 255 / 0.55);
  --border-warn: rgb(240 168 40 / 0.45);
  --border-danger-soft: rgb(243 199 199 / 0.35);
  --border-success-soft: rgb(189 235 200 / 0.35);
  --border-attention-soft: rgb(243 211 160 / 0.35);
  --fill-subtle: rgb(180 190 220 / 0.1);
  --fill-badge: rgb(180 190 220 / 0.14);
  --fill-subtle-strong: rgb(180 190 220 / 0.18);
  --fill-track: rgb(80 90 120 / 0.8);
  --fill-chip-info: rgb(79 140 255 / 0.18);
  --shadow-card:
    0 10px 30px rgb(0 0 0 / 0.35), 0 0 0 1px rgb(255 255 255 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.22);
  --shadow-card-sm:
    0 10px 30px rgb(0 0 0 / 0.35), 0 0 0 1px rgb(255 255 255 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.22);
  --shadow-modal: 0 34px 80px -14px rgb(0 0 0 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.28);
  --shadow-inset-hi: inset 0 1px 0 rgb(255 255 255 / 0.22);
  --shadow-panel: 0 18px 50px rgb(0 0 0 / 0.28), inset 0 1px 0 rgb(255 255 255 / 0.12);
  --shadow-check: 0 2px 6px rgb(52 199 89 / 0.4);
  --scrim: rgb(4 8 18 / 0.55);
  --radius-input: 11px;
  --radius-btn: 13px;
  --radius-card: 18px;
  --radius-opt: 12px;
  --radius-banner: 14px;
  --radius-modal: 24px;
  --blur-card: 24px;
  --blur-card-saturate: 165%;
  --blur-topbar: 30px;
  --field-a: rgb(58 128 255 / 0.22);
  --field-b: rgb(104 176 255 / 0.16);
  --field-c: rgb(122 100 240 / 0.1);
  --display-weight: 600;
  --display-tracking: -0.005em;
  --motion-duration-press: 120ms;
  --motion-duration-hover: 220ms;
  --motion-duration-ui: 280ms;
  --motion-duration-stage: 380ms;
  --motion-duration-reveal: 560ms;
  --motion-ease-out: cubic-bezier(0.32, 0.72, 0, 1);
  --motion-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --motion-ease-springy: cubic-bezier(0.34, 1.3, 0.64, 1);
  --motion-distance-sm: 6px;
  --motion-scale-press: 0.985;
  --motion-lift-hover: -1px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/styles/themes/theme-discipline.test.ts`

Expected: PASS. If extras/missing print, fix the CSS — do not weaken the test.

- [ ] **Step 5: Commit**

```bash
git add src/styles/themes/tokens.css src/styles/themes/glass.css src/styles/themes/glass-dark.css src/styles/themes/theme-discipline.test.ts
git commit -m "feat: add glass and glass-dark tokens"
```

---

### Task 3: Field, cards, and shadcn mapping

**Files:**
- Create: `src/styles/components/field.css`
- Create: `src/styles/components/cards.css`
- Modify: `src/app/globals.css` (replace entirely)
- Test: `src/styles/themes/theme-discipline.test.ts` (append field/cards assertions)

**Interfaces:**
- Consumes: `--field-*`, `--surface-*`, `--border-*`, `--shadow-*`, `--blur-*`, `--motion-*` from Task 2; brand tokens declared in this task
- Produces: `#field`, `.glass-card`, `.glass-card--overlay`, `.glass-panel`, `.glass-panel--inbox`, `.glass-topbar`, `.chip-status` and modifiers `--wip --blocked --info --success --muted --attention`; shadcn `--background` etc. aliased to glass tokens

- [ ] **Step 1: Extend the discipline test (fails until files exist)**

Append to `src/styles/themes/theme-discipline.test.ts`:

```ts
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
});
```

Run: `bun test src/styles/themes/theme-discipline.test.ts`

Expected: FAIL — `ENOENT` `field.css` / `cards.css`.

- [ ] **Step 2: Create field.css**

```css
#field {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(
      62vmax 62vmax at -14% -22%,
      var(--field-a),
      transparent 55%
    ),
    radial-gradient(
      54vmax 54vmax at 118% 18%,
      var(--field-b),
      transparent 55%
    ),
    radial-gradient(
      48vmax 48vmax at 24% 128%,
      var(--field-c),
      transparent 55%
    );
}
```

- [ ] **Step 3: Create cards.css**

```css
@layer components {
  .glass-card {
    background: var(--surface-card);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-card);
    backdrop-filter: blur(var(--blur-card)) saturate(var(--blur-card-saturate));
    transition:
      transform var(--motion-duration-hover) var(--motion-ease-out),
      box-shadow var(--motion-duration-hover) var(--motion-ease-out);
  }
  .glass-card:hover {
    transform: translateY(var(--motion-lift-hover));
  }
  .glass-card:active {
    transform: scale(var(--motion-scale-press));
  }
  .glass-card--overlay {
    transform: rotate(1deg);
    box-shadow: var(--shadow-modal);
  }
  .glass-card--overlay:hover,
  .glass-card--overlay:active {
    transform: rotate(1deg);
  }

  .glass-panel {
    background: var(--surface-panel);
    border: 1px solid var(--border-panel);
    border-radius: var(--radius-banner);
    box-shadow: var(--shadow-panel);
    backdrop-filter: blur(var(--blur-card)) saturate(var(--blur-card-saturate));
  }
  .glass-panel--inbox {
    border-style: dashed;
    border-color: var(--border-hairline);
  }

  .glass-topbar {
    background: var(--surface-topbar);
    backdrop-filter: blur(var(--blur-topbar)) saturate(var(--blur-card-saturate));
    border-bottom: 1px solid var(--border-divider);
  }

  .chip-status {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    border: 1px solid var(--border-hairline);
    padding: 0.125rem 0.5rem;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .chip-status--wip {
    background: var(--surface-warn);
    border-color: var(--border-warn);
    color: var(--color-amber);
  }
  .chip-status--blocked {
    background: var(--surface-danger);
    border-color: var(--border-danger-soft);
    color: var(--color-redink);
  }
  .chip-status--info {
    background: var(--surface-info);
    border-color: var(--fill-chip-info);
    color: var(--color-brand);
  }
  .chip-status--success {
    background: var(--surface-success);
    border-color: var(--border-success-soft);
    color: var(--color-okink);
  }
  .chip-status--muted {
    background: var(--fill-badge);
    border-color: var(--border-hairline);
    color: var(--color-grey);
  }
  .chip-status--attention {
    background: var(--surface-attention);
    border-color: var(--border-attention-soft);
    color: var(--color-amber);
  }
}

@media (prefers-reduced-motion: reduce) {
  .glass-card,
  .glass-card:hover,
  .glass-card:active {
    transition: none;
    transform: none;
  }
}
```

- [ ] **Step 4: Replace globals.css**

Overwrite `src/app/globals.css` with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "../styles/themes/tokens.css";
@import "../styles/themes/glass.css";
@import "../styles/themes/glass-dark.css";
@import "../styles/components/field.css";
@import "../styles/components/cards.css";
@plugin "@tailwindcss/typography";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sys);
  --font-mono: var(--font-mono-stack);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-brand: var(--color-brand-raw);
  --color-ok: var(--color-ok-raw);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  --font-sys: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI",
    Roboto, Helvetica, Arial, sans-serif;
  --font-mono-stack: ui-monospace, "SFMono-Regular", monospace;
  --color-brand-raw: #1f6feb;
  --color-brand: #1f6feb;
  --color-brandd: #1659c4;
  --color-navy: #1f3a5f;
  --color-ok-raw: #34c759;
  --color-ok: #34c759;
  --color-okink: #248a3d;
  --color-orange: #f39200;
  --color-amber: #9a6700;
  --color-red: #ff3b30;
  --color-redink: #c70014;
  --background: var(--surface-page);
  --foreground: var(--color-ink);
  --card: var(--surface-card);
  --card-foreground: var(--color-ink);
  --popover: var(--surface-raised);
  --popover-foreground: var(--color-ink);
  --primary: var(--color-brand);
  --primary-foreground: #ffffff;
  --secondary: var(--fill-subtle);
  --secondary-foreground: var(--color-ink);
  --muted: var(--fill-subtle);
  --muted-foreground: var(--color-grey);
  --accent: var(--fill-subtle-strong);
  --accent-foreground: var(--color-ink);
  --destructive: var(--color-red);
  --border: var(--border-hairline);
  --input: var(--border-input);
  --ring: var(--color-brand);
  --radius: var(--radius-card);
  --chart-1: var(--color-brand);
  --chart-2: var(--color-ok);
  --chart-3: var(--color-orange);
  --chart-4: var(--color-grey);
  --chart-5: var(--color-navy);
  --sidebar: var(--surface-card);
  --sidebar-foreground: var(--color-ink);
  --sidebar-primary: var(--color-brand);
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: var(--fill-subtle);
  --sidebar-accent-foreground: var(--color-ink);
  --sidebar-border: var(--border-hairline);
  --sidebar-ring: var(--color-brand);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html,
  body {
    height: 100%;
    min-height: 100%;
  }
  html {
    font-family: var(--font-sys);
  }
  body {
    margin: 0;
    font-family: var(--font-sys);
    background: var(--surface-page);
    background-repeat: no-repeat;
    background-attachment: fixed;
    color: var(--color-ink);
    -webkit-font-smoothing: antialiased;
  }
  h1 {
    font-weight: var(--display-weight);
    letter-spacing: var(--display-tracking);
  }
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--color-scrollbar);
    border-radius: 3px;
  }
}
```

Do **not** leave a `.dark { … }` oklch block.

- [ ] **Step 5: Run tests**

Run: `bun test src/styles/themes/theme-discipline.test.ts src/lib/theme.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/styles/components/field.css src/styles/components/cards.css src/app/globals.css src/styles/themes/theme-discipline.test.ts
git commit -m "feat: map glass tokens onto field, cards, and shadcn"
```

---

### Task 4: Layout chrome and toggle

**Files:**
- Create: `src/components/theme-toggle.tsx`
- Modify: `src/app/layout.tsx` (replace entirely)

**Interfaces:**
- Consumes: `THEME_BOOTSTRAP_SCRIPT`, `THEME_STORAGE_KEY`, `applyTheme`, `resolveTheme`, `shouldFollowSystem` from `src/lib/theme.ts`
- Produces: root layout with `data-theme="glass"`, `suppressHydrationWarning` on `<html>`, injected bootstrap script, `#field`, 40px chrome, `ThemeToggle`

- [ ] **Step 1: Write ThemeToggle**

Create `src/components/theme-toggle.tsx`:

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  resolveTheme,
  shouldFollowSystem,
  type ThemeName,
  type ThemeRoot,
} from "@/lib/theme";

/**
 * Two-state light/dark control. Writes `localStorage.theme` as `"light"` | `"dark"`.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>("glass");

  useEffect(() => {
    const root = document.documentElement;
    const current = root.dataset.theme === "glass-dark" ? "glass-dark" : "glass";
    setTheme(current);

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (!shouldFollowSystem(stored)) return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = resolveTheme(null, mq.matches);
      applyTheme(next, root as ThemeRoot);
      setTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const dark = theme === "glass-dark";

  function toggle() {
    const next: ThemeName = dark ? "glass" : "glass-dark";
    const stored = next === "glass-dark" ? "dark" : "light";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, stored);
    } catch {
      /* private mode */
    }
    applyTheme(next, document.documentElement as ThemeRoot);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="inline-flex size-8 items-center justify-center rounded-[var(--radius-btn)] text-[var(--color-ink)] hover:bg-[var(--fill-subtle)]"
      aria-label="Toggle colour theme"
      aria-pressed={dark}
      suppressHydrationWarning
      onClick={toggle}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
```

- [ ] **Step 2: Replace layout.tsx**

Overwrite `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "cardstock",
  description: "Hosted kanban over markdown trackers",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="glass"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <div id="field" aria-hidden="true" />
        <header className="glass-topbar flex h-10 shrink-0 items-center justify-between px-4">
          <Link href="/" className="text-sm font-semibold">
            cardstock
          </Link>
          <ThemeToggle />
        </header>
        {children}
      </body>
    </html>
  );
}
```

Do **not** import Geist. Do **not** add `className="dark"` anywhere.

- [ ] **Step 3: Typecheck**

Run: `bun run check`

Expected: PASS (Biome + `tsc --noEmit`). If Biome complains about the inline script, keep `dangerouslySetInnerHTML` — it is required.

- [ ] **Step 4: Commit**

```bash
git add src/components/theme-toggle.tsx src/app/layout.tsx
git commit -m "feat: add glass chrome and theme toggle"
```

---

### Task 5: Board surfaces

**Files:**
- Modify: `src/components/board/card-item.tsx`
- Modify: `src/components/board/lane-column.tsx`
- Modify: `src/components/board/filter-bar.tsx`
Do not change `board-view.tsx` (DnD, filters, and header copy stay).

**Interfaces:**
- Consumes: `.glass-card`, `.glass-card--overlay`, `.glass-panel`, `.glass-panel--inbox`, `.glass-topbar`, `.chip-status--*`
- Produces: same `data-id` / `data-lane` / `data-priority` behaviour; glass material only

- [ ] **Step 1: Restyle card-item.tsx**

Replace the `STATUS_COLOR` map (lines 11–20) with:

```ts
const STATUS_CHIP: Record<string, string> = {
  wip: "chip-status chip-status--wip",
  built: "chip-status chip-status--info",
  handed: "chip-status chip-status--info",
  held: "chip-status chip-status--muted",
  blocked: "chip-status chip-status--blocked",
  shipped: "chip-status chip-status--success",
  done: "chip-status chip-status--success",
  backlog: "chip-status chip-status--muted",
};
```

On the `<article>`, replace
`className={\`group relative rounded-lg border bg-card p-3 shadow-sm ${props.overlay ? "rotate-1 shadow-xl" : ""} ${card.archived_at ? "opacity-60" : ""}\`}`
with
`className={\`group relative glass-card p-3 ${props.overlay ? "glass-card--overlay" : ""} ${card.archived_at ? "opacity-60" : ""}\`}`.

Status span: `className={STATUS_CHIP[card.status] ?? "chip-status chip-status--muted"}`.

Needs span: `className="chip-status chip-status--attention"` (drop `bg-amber-400 text-black`).

Days span: `className={\`chip-status ${overSla ? "chip-status--attention" : "chip-status--muted"}\`}`.

Do not change `data-id`, links, `data-testid="open-issue"`, or patch handlers.

- [ ] **Step 2: Restyle lane-column.tsx**

Replace `KIND_COLOR` with:

```ts
const KIND_COLOR: Record<Lane["kind"], string> = {
  inbox: "text-[var(--color-grey)]",
  work: "text-[var(--color-ink)]",
  waiting: "text-[var(--color-orange)]",
  built: "text-[var(--color-brand)]",
  done: "text-[var(--color-ok)]",
  archive: "text-[var(--color-grey)]",
};
```

On the `<section>`, replace
`className={\`flex shrink-0 flex-col rounded-xl border bg-muted/40 ${width} ${lane.kind === "inbox" ? "border-dashed bg-transparent" : ""} ${isOver ? "ring-2 ring-primary/60" : ""}\`}`
with
`className={\`glass-panel flex shrink-0 flex-col ${width} ${lane.kind === "inbox" ? "glass-panel--inbox" : ""} ${isOver ? "ring-2 ring-primary/60" : ""}\`}`.

Keep `data-lane={lane.key}`.

- [ ] **Step 3: Restyle filter-bar.tsx**

On the outer `#filters` div, replace
`className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:px-6"`
with
`className="glass-topbar sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6"`.

Chip helper: leave the on/off logic; change the off state from `bg-background` to `bg-[var(--surface-input)]` and keep `border-primary bg-primary/10` when on.

- [ ] **Step 4: Typecheck**

Run: `bun run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/board/card-item.tsx src/components/board/lane-column.tsx src/components/board/filter-bar.tsx
git commit -m "feat: frost board cards, lanes, and filter bar"
```

---

### Task 6: Remaining screens

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/p/[project]/page.tsx`
- Modify: `src/app/p/[project]/b/[board]/timeline/page.tsx`
- Modify: `src/app/p/[project]/b/[board]/c/[externalId]/page.tsx`
- Modify: `src/app/p/[project]/b/[board]/c/[externalId]/card-editor.tsx`

**Interfaces:**
- Consumes: `.glass-card`, `.glass-panel`, `.chip-status--*`
- Produces: same routes and copy; glass shells only

- [ ] **Step 1: Home `src/app/page.tsx`**

Replace project `<li className="rounded-xl border bg-card p-5">` with `className="glass-card p-5"`.

- [ ] **Step 2: Login `src/app/login/page.tsx`**

Wrap the inner `max-w-sm` column:

```tsx
<div className="glass-card w-full max-w-sm space-y-6 p-6">
```

Keep the existing error copy (`That link has expired…`, `This board is invite-only.`).

- [ ] **Step 3: Project `src/app/p/[project]/page.tsx`**

Board tiles: `className="glass-card p-4"` instead of `rounded-xl border bg-card p-4`.

Wrap the members `<ul>` plus `AddMemberForm` in `<div className="glass-panel p-4">`.

- [ ] **Step 4: Timeline `src/app/p/[project]/b/[board]/timeline/page.tsx`**

On `row`, replace `className="flex items-baseline gap-3 rounded-lg border bg-card px-3 py-2 text-sm"` with `className="glass-card flex items-baseline gap-3 px-3 py-2 text-sm"`.

- [ ] **Step 5: Card page + editor**

In `page.tsx`, change `<main className="mx-auto w-full max-w-4xl p-6">` to `className="glass-card mx-auto w-full max-w-4xl p-6"`. Status pill: `className="chip-status chip-status--muted"`.

In `card-editor.tsx`, replace the editor shell `className="mt-4 space-y-4 rounded-xl border p-4"` with `className="glass-panel mt-4 space-y-4 p-4"`.

- [ ] **Step 6: Typecheck**

Run: `bun run check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/login/page.tsx src/app/p/[project]/page.tsx src/app/p/[project]/b/[board]/timeline/page.tsx src/app/p/[project]/b/[board]/c/[externalId]/page.tsx src/app/p/[project]/b/[board]/c/[externalId]/card-editor.tsx
git commit -m "feat: frost login, lists, timeline, and card editor"
```

---

### Task 7: Verify unit + e2e

**Files:**
- Test: `src/lib/theme.test.ts`, `src/styles/themes/theme-discipline.test.ts`, `e2e/board.spec.ts`, `e2e/hydration.spec.ts` (run only; do not change selectors unless a new topbar actually breaks them — it must not)

**Interfaces:**
- Consumes: Tasks 1–6
- Produces: green unit suite and green Playwright against the local stack

- [ ] **Step 1: Unit tests**

Run: `bun test`

Expected: PASS, including `theme.test.ts`, `theme-discipline.test.ts`, and existing `etl/*.test.ts`.

- [ ] **Step 2: Playwright**

Requires the local stack from `playwright.config.ts`: `bunx supabase start`, seed/import if needed, then:

Run: `bun run test:e2e`

Expected: PASS. `data-lane` still finds lane `h2`s; `data-id` still finds cards; login still uses Email / Password / “Sign in with password”; hydration spec still reports zero `/hydrat/` console errors.

If e2e fails because the new chrome link intercepts something, fix chrome — do not loosen `data-lane` / `data-id` assertions.

- [ ] **Step 3: Commit only if e2e required a fix**

```bash
git add -u
git commit -m "fix: keep board e2e selectors working with glass chrome"
```

Skip this commit if nothing changed.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| `resolveTheme` / `applyTheme` / storage key `theme` | 1 |
| Bootstrap never throws; inline script | 1 + 4 |
| Follow OS until user picks; live `matchMedia` only then | 4 (`ThemeToggle` effect) |
| Light + dark token files, identical keys | 2 |
| Drop aurora/SAP/rail tokens | 2 (not in contract) |
| Static `#field` radials | 3 |
| shadcn aliases; delete `.dark` oklch | 3 |
| System fonts, drop Geist | 3 + 4 |
| `.glass-card` / `.glass-panel` / `.glass-topbar` | 3 + 5 + 6 |
| Status chips | 3 + 5 |
| Inbox dashed hairline only | 3 + 5 |
| Layout chrome + toggle | 4 |
| Login/home/project/timeline/editor | 6 |
| Token discipline + mapping tests | 1 + 2 + 3 |
| Existing e2e | 7 |
| No mood aurora, no System option, no DB prefs | out of scope (not tasked) |
