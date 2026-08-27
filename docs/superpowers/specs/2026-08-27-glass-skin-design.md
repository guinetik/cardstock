# Glass skin — design

**Date:** 2026-08-27
**Status:** approved in conversation; implementation follows this document.
**Origin:** an internal designer glass theme — a set of theme tokens, light-glass values, card styles, and an animated aurora used as the field-geometry source. This app steals the token contract and light-glass values, invents a dark-glass sibling, and replaces the animated aurora with a static radial-gradient field.

---

## The problem

cardstock ships stock shadcn: opaque `oklch` neutrals, Geist, `rounded-lg border bg-card`. The designer’s glass look — frosted white planes, white hairlines, blue-slate ink, a luminous field behind the page — is the visual language we want here. Glass without a coloured field behind it reads as flat grey; the field is required. An animated aurora is not: this board does not have a wizard mood, and a still gradient is enough for the frosting to refract.

## What we're building

A **full glass skin** for every screen (login, home, project, board, timeline, card editor):

- Light glass copied from the designer.
- Dark glass invented in the same token contract.
- A two-state theme toggle, persisted in `localStorage` only (follow the OS until the user picks).
- System UI fonts, not Geist.
- Hybrid wiring: tokens mapped onto shadcn so primitives frost for free; board chrome uses semantic classes (`.glass-card`, `.glass-panel`, `.glass-topbar`).

No behaviour change to drag, filters, ETL, auth, or data.

---

## Architecture

The theme is a CSS contract. Light and dark are two answers to the same tokens. JS only chooses which answer is on `<html>`.

### Files

| Path | Role |
|---|---|
| `src/styles/themes/tokens.css` | Comment contract: every token both themes must answer. |
| `src/styles/themes/glass.css` | `:root[data-theme='glass']` — light values from the designer. |
| `src/styles/themes/glass-dark.css` | `:root[data-theme='glass-dark']` — dark values (new). |
| `src/styles/components/field.css` | `#field` — fixed, pointer-events-none, three **static** radial gradients. |
| `src/styles/components/cards.css` | `.glass-card`, `.glass-panel`, `.glass-topbar`. |
| `src/app/globals.css` | Imports the above; `@theme` maps tokens onto shadcn; drops Geist and the unused `.dark { … }` oklch block. |
| `src/components/theme-toggle.tsx` | Client toggle. |
| `src/lib/theme.ts` | `THEME_STORAGE_KEY`, `resolveTheme`, `applyTheme` (sets `data-theme` + `color-scheme`). |
| `src/app/layout.tsx` | Blocking bootstrap script, `#field`, compact chrome with the toggle, system font on `body`. |

Do **not** copy aurora blobs, mood modifiers, rail, catalog, SAP, VT, credentials, or `btn-cta` CSS. This app is glass-only (light or dark). shadcn `Button` stays.

### Apply

- `<html data-theme="glass">` or `data-theme="glass-dark"`. Default in markup is `glass`; the bootstrap script overwrites it before paint.
- Also set `style.colorScheme` / `color-scheme` to `light` or `dark` so native controls match.
- Do **not** add a `.dark` class. shadcn’s `dark:` variants stay in the source and stay dormant; theming is 100% `data-theme` + CSS variables. Outline/ghost buttons therefore use the light-path classes (`border-border`, `bg-background`) whose variables already flip with the theme.

### Theme mapping

`src/lib/theme.ts` exports `THEME_STORAGE_KEY = 'theme'` and:

`resolveTheme(stored: string | null, prefersDark: boolean): 'glass' | 'glass-dark'`

- `stored === 'light'` → `glass`
- `stored === 'dark'` → `glass-dark`
- anything else (including `null`) → `prefersDark ? 'glass-dark' : 'glass'`

Tests import this function. The blocking layout script inlines the same three rules and must stay in sync (it cannot import a module before paint).

### Bootstrap script

Blocking inline `<script>` in the root layout (not `next/script` after hydration). It reads storage, reads `prefers-color-scheme`, then applies `resolveTheme`'s rules:

1. Try `localStorage.theme`; on throw or missing, treat as `null`.
2. Read `prefers-color-scheme: dark`.
3. Apply the same three rules as `resolveTheme`.
4. Set `document.documentElement.dataset.theme` and `color-scheme`. Never throw.

Invalid stored values are treated as `null`. They are not rewritten until the user toggles.

### Toggle persistence

- Key: `localStorage.theme`.
- Values: `"light"` | `"dark"` only.
- After the user toggles, stop following the OS. No `matchMedia` listener once a value is stored.
- If no value is stored, listen to `prefers-color-scheme` and update live.
- No “System” option. No member-pref / DB sync.

### Fonts

Drop `Geist` / `Geist_Mono` from `layout.tsx`.

```
--font-sys: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--font-mono: ui-monospace, "SFMono-Regular", monospace;
```

`body` uses `--font-sys`. Card IDs and counts keep `font-mono`. Display headings use `--display-weight: 600` and `--display-tracking: -0.005em`.

---

## Token contract

Both theme files must answer every token listed here. A token that resolves in one theme and not the other is a bug.

### Brand (shared, not retuned per theme)

Copied from the designer `@theme` block. Declared once in `globals.css` `@theme`, not in the per-theme files:

| Token | Value |
|---|---|
| `--color-brand` | `#1f6feb` |
| `--color-brandd` | `#1659c4` |
| `--color-navy` | `#1f3a5f` |
| `--color-ok` | `#34c759` |
| `--color-okink` | `#248a3d` |
| `--color-orange` | `#f39200` |
| `--color-amber` | `#9a6700` |
| `--color-red` | `#ff3b30` |
| `--color-redink` | `#c70014` |

### Light (`data-theme='glass'`)

Stolen from designer `glass.css`:

| Token | Value |
|---|---|
| `--color-bg` | `#e9e9ed` |
| `--color-card` | `rgb(255 255 255 / 0.52)` |
| `--color-fill` | `rgb(255 255 255 / 0.34)` |
| `--color-sep` | `rgb(255 255 255 / 0.7)` |
| `--color-ink` | `#1e2740` |
| `--color-ink2` | `#3a4560` |
| `--color-grey` | `#5e6a88` |
| `--color-grey3` | `#a6b0c8` |
| `--color-ink-strong` | `#2a2e3a` |
| `--color-grey-soft` | `#5c6376` |
| `--color-grey-faint` | `#8890a6` |
| `--color-grey-faintest` | `#b9c0d0` |
| `--color-grey-badge` | `#6e7488` |
| `--color-scrollbar` | `rgb(100 116 139 / 0.5)` |
| `--surface-page` | `#eef2fa` |
| `--surface-card` | `rgb(255 255 255 / 0.52)` |
| `--surface-card-sunken` | `rgb(255 255 255 / 0.34)` |
| `--surface-input` | `rgb(255 255 255 / 0.66)` |
| `--surface-raised` | `rgb(255 255 255 / 0.8)` |
| `--surface-topbar` | `rgb(255 255 255 / 0.58)` |
| `--surface-panel` | `rgb(255 255 255 / 0.34)` |
| `--surface-warn` | `rgb(255 243 221 / 0.75)` |
| `--surface-info` | `rgb(239 245 254 / 0.7)` |
| `--surface-danger` | `rgb(253 235 235 / 0.75)` |
| `--surface-success` | `rgb(227 247 232 / 0.75)` |
| `--surface-attention` | `rgb(253 246 234 / 0.75)` |
| `--border-hairline` | `rgb(255 255 255 / 0.7)` |
| `--border-strong` | `rgb(255 255 255 / 0.85)` |
| `--border-input` | `rgb(255 255 255 / 0.85)` |
| `--border-panel` | `rgb(255 255 255 / 0.55)` |
| `--border-divider` | `rgb(40 56 100 / 0.16)` |
| `--border-focus-soft` | `rgb(207 224 246 / 0.9)` |
| `--border-warn` | `rgb(240 168 40 / 0.5)` |
| `--border-danger-soft` | `rgb(243 199 199 / 0.85)` |
| `--border-success-soft` | `rgb(189 235 200 / 0.85)` |
| `--border-attention-soft` | `rgb(243 211 160 / 0.85)` |
| `--fill-subtle` | `rgb(120 130 160 / 0.12)` |
| `--fill-badge` | `rgb(120 130 160 / 0.14)` |
| `--fill-subtle-strong` | `rgb(120 130 170 / 0.18)` |
| `--fill-track` | `rgb(196 203 219 / 0.8)` |
| `--fill-chip-info` | `rgb(238 244 254 / 0.8)` |
| `--shadow-card` | `0 10px 30px rgb(30 50 120 / 0.13), 0 0 0 1px rgb(255 255 255 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.85)` |
| `--shadow-card-sm` | same as `--shadow-card` |
| `--shadow-modal` | `0 34px 80px -14px rgb(20 25 60 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.9)` |
| `--shadow-inset-hi` | `inset 0 1px 0 rgb(255 255 255 / 0.7)` |
| `--shadow-panel` | `0 18px 50px rgb(30 50 120 / 0.1), inset 0 1px 0 rgb(255 255 255 / 0.6)` |
| `--shadow-check` | `0 2px 6px rgb(52 199 89 / 0.4)` |
| `--scrim` | `rgb(18 22 42 / 0.3)` |
| `--radius-input` | `11px` |
| `--radius-btn` | `13px` |
| `--radius-card` | `18px` |
| `--radius-opt` | `12px` |
| `--radius-banner` | `14px` |
| `--radius-modal` | `24px` |
| `--blur-card` | `24px` |
| `--blur-card-saturate` | `165%` |
| `--blur-topbar` | `30px` |
| `--field-a` | `rgb(58 128 255 / 0.44)` |
| `--field-b` | `rgb(104 176 255 / 0.3)` |
| `--field-c` | `rgb(122 100 240 / 0.14)` |
| `--display-weight` | `600` |
| `--display-tracking` | `-0.005em` |
| `--motion-duration-press` | `120ms` |
| `--motion-duration-hover` | `220ms` |
| `--motion-duration-ui` | `280ms` |
| `--motion-duration-stage` | `380ms` |
| `--motion-duration-reveal` | `560ms` |
| `--motion-ease-out` | `cubic-bezier(0.32, 0.72, 0, 1)` |
| `--motion-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--motion-ease-springy` | `cubic-bezier(0.34, 1.3, 0.64, 1)` |
| `--motion-distance-sm` | `6px` |
| `--motion-scale-press` | `0.985` |
| `--motion-lift-hover` | `-1px` |

### Dark (`data-theme='glass-dark'`)

Same keys. White hairline + inset highlight stay (that is the glass edge). Ink becomes light blue-slate. Surfaces are translucent white at low alpha over `#101624`, not opaque charcoal.

| Token | Value |
|---|---|
| `--color-bg` | `#101624` |
| `--color-card` | `rgb(255 255 255 / 0.09)` |
| `--color-fill` | `rgb(255 255 255 / 0.05)` |
| `--color-sep` | `rgb(255 255 255 / 0.18)` |
| `--color-ink` | `#e8ecf7` |
| `--color-ink2` | `#c5cce0` |
| `--color-grey` | `#8b95b0` |
| `--color-grey3` | `#5a6480` |
| `--color-ink-strong` | `#f3f5fb` |
| `--color-grey-soft` | `#9aa3bb` |
| `--color-grey-faint` | `#7a849c` |
| `--color-grey-faintest` | `#5c6680` |
| `--color-grey-badge` | `#8b95b0` |
| `--color-scrollbar` | `rgb(148 163 184 / 0.45)` |
| `--surface-page` | `#101624` |
| `--surface-card` | `rgb(255 255 255 / 0.09)` |
| `--surface-card-sunken` | `rgb(255 255 255 / 0.05)` |
| `--surface-input` | `rgb(255 255 255 / 0.12)` |
| `--surface-raised` | `rgb(255 255 255 / 0.16)` |
| `--surface-topbar` | `rgb(16 22 40 / 0.65)` |
| `--surface-panel` | `rgb(255 255 255 / 0.05)` |
| `--surface-warn` | `rgb(255 243 221 / 0.14)` |
| `--surface-info` | `rgb(239 245 254 / 0.12)` |
| `--surface-danger` | `rgb(253 235 235 / 0.14)` |
| `--surface-success` | `rgb(227 247 232 / 0.12)` |
| `--surface-attention` | `rgb(253 246 234 / 0.14)` |
| `--border-hairline` | `rgb(255 255 255 / 0.18)` |
| `--border-strong` | `rgb(255 255 255 / 0.28)` |
| `--border-input` | `rgb(255 255 255 / 0.28)` |
| `--border-panel` | `rgb(255 255 255 / 0.12)` |
| `--border-divider` | `rgb(180 200 255 / 0.14)` |
| `--border-focus-soft` | `rgb(79 140 255 / 0.55)` |
| `--border-warn` | `rgb(240 168 40 / 0.45)` |
| `--border-danger-soft` | `rgb(243 199 199 / 0.35)` |
| `--border-success-soft` | `rgb(189 235 200 / 0.35)` |
| `--border-attention-soft` | `rgb(243 211 160 / 0.35)` |
| `--fill-subtle` | `rgb(180 190 220 / 0.10)` |
| `--fill-badge` | `rgb(180 190 220 / 0.14)` |
| `--fill-subtle-strong` | `rgb(180 190 220 / 0.18)` |
| `--fill-track` | `rgb(80 90 120 / 0.8)` |
| `--fill-chip-info` | `rgb(79 140 255 / 0.18)` |
| `--shadow-card` | `0 10px 30px rgb(0 0 0 / 0.35), 0 0 0 1px rgb(255 255 255 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.22)` |
| `--shadow-card-sm` | same as `--shadow-card` |
| `--shadow-modal` | `0 34px 80px -14px rgb(0 0 0 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.28)` |
| `--shadow-inset-hi` | `inset 0 1px 0 rgb(255 255 255 / 0.22)` |
| `--shadow-panel` | `0 18px 50px rgb(0 0 0 / 0.28), inset 0 1px 0 rgb(255 255 255 / 0.12)` |
| `--shadow-check` | `0 2px 6px rgb(52 199 89 / 0.4)` |
| `--scrim` | `rgb(4 8 18 / 0.55)` |
| radii, blur, display, motion | **same as light** |
| `--field-a` | `rgb(58 128 255 / 0.22)` |
| `--field-b` | `rgb(104 176 255 / 0.16)` |
| `--field-c` | `rgb(122 100 240 / 0.10)` |

### Field (replaces aurora)

`#field` is `position: fixed; inset: 0; z-index: -1; pointer-events: none`. Background is three stacked `radial-gradient`s, not elements, not keyframes:

- A: `--field-a`, ellipse, anchored upper-left (~`-14%` / `-22%`), ~62vmax.
- B: `--field-b`, upper-right (~`118%` / `18%`), ~54vmax.
- C: `--field-c`, bottom-center (~`24%` / `128%`), ~48vmax.

`body` background is `--surface-page`, `background-attachment: fixed`, `background-repeat: no-repeat` (a gradient on `body` would tile at 100vh). No `prefers-reduced-motion` branch: the field does not move.

### Dropped from the designer (do not port)

Aurora moods and blob animation; `--frame-bg*` ; `--surface-warn-soft`, `--surface-banner`, `--surface-danger-soft` ; `--border-warn-soft`, `--border-banner` ; `--fill-badge-violet`, `--fill-badge-blue`, `--fill-badge-danger`, `--fill-icon-info` ; `--shadow-seg-active`, `--shadow-knob-inset`, `--shadow-rail-active` ; `--color-violet-ink` ; `--aurora-*`.

### Shadcn map (`globals.css` `:root` and `@theme`)

| shadcn token | glass token |
|---|---|
| `--background` | `--surface-page` |
| `--foreground` | `--color-ink` |
| `--card` | `--surface-card` |
| `--card-foreground` | `--color-ink` |
| `--popover` | `--surface-raised` |
| `--popover-foreground` | `--color-ink` |
| `--primary` | `--color-brand` |
| `--primary-foreground` | `#ffffff` |
| `--secondary` | `--fill-subtle` |
| `--secondary-foreground` | `--color-ink` |
| `--muted` | `--fill-subtle` |
| `--muted-foreground` | `--color-grey` |
| `--accent` | `--fill-subtle-strong` |
| `--accent-foreground` | `--color-ink` |
| `--destructive` | `--color-red` |
| `--border` | `--border-hairline` |
| `--input` | `--border-input` |
| `--ring` | `--color-brand` |
| `--radius` | `--radius-card` (18px) |
| `--sidebar*` | same family as card/ink/hairline (unused today; keep mapped so they cannot drift) |

Delete the current oklch `:root` and `.dark` blocks. shadcn tokens are aliases, not a second palette.

---

## Components

Nothing about drag, filters, or data changes.

### Root chrome

`layout.tsx` renders:

1. Bootstrap script.
2. `#field`.
3. A compact topbar (~40px): product name `cardstock` as a home link on the left; `ThemeToggle` on the right. Present on login too.
4. `{children}`.

Board `header` + `FilterBar` stay where they are. Filter bar `sticky top-0` sticks under this chrome.

### Semantic classes

`.glass-card` — `background: var(--surface-card); border: 1px solid var(--border-hairline); border-radius: var(--radius-card); box-shadow: var(--shadow-card); backdrop-filter: blur(var(--blur-card)) saturate(var(--blur-card-saturate));`. Used for kanban cards, project tiles, board tiles, timeline rows, login form shell, card-editor shell.

`.glass-panel` — `--surface-panel`, `--border-panel`, `--radius-banner`, `--shadow-panel`, same blur. Used for lane columns. Inbox uses the same panel tokens; the only difference is `border-style: dashed` on `--border-hairline`.

`.glass-topbar` — `--surface-topbar`, `blur(var(--blur-topbar))`, bottom edge `--border-divider` (not hairline: a white rim on frost is invisible). Used for the filter bar.

Hover on cards/lanes: `translateY(var(--motion-lift-hover))` over `--motion-duration-hover` / `--motion-ease-out`. Press: `scale(var(--motion-scale-press))`. `@media (prefers-reduced-motion: reduce)` sets motion durations to `0`.

### Status chips

Replace opaque Tailwind solids (`bg-amber-500`, `bg-rose-600`, …) with frosted pills (fill + matching soft border + ink):

| Status / state | Surface |
|---|---|
| `wip` | `--surface-warn` / `--border-warn` |
| `blocked` | `--surface-danger` / `--border-danger-soft` |
| `built`, `handed` | `--surface-info` / `--fill-chip-info` |
| `shipped`, `done` | `--surface-success` / `--border-success-soft` |
| `held`, `backlog` | `--fill-badge` / `--border-hairline` |
| waiting-lane over SLA | `--surface-attention` / `--border-attention-soft` |

Lane kind colours stay semantic (`--color-grey`, `--color-orange`, `--color-brand`, `--color-ok`) instead of `text-amber-600 dark:text-amber-400`.

### Per screen

- **Login** — one `.glass-card` around the existing form.
- **Home / project** — grid of `.glass-card` links; members list in a `.glass-panel`.
- **Board** — existing header + `.glass-topbar` filter bar; lanes `.glass-panel`; cards `.glass-card`. Drag overlay: slight rotate + `--shadow-modal`.
- **Timeline / card editor** — same card language.

### Theme toggle

Client component: sun/moon icon button, `aria-label="Toggle colour theme"`, `aria-pressed` true when dark. Writes `localStorage.theme` and sets `data-theme` + `color-scheme`. Does not round-trip to the server.

---

## Errors

- Bootstrap never throws; missing/invalid storage → OS → light.
- Board/login errors stay `text-destructive` (mapped to `--color-red`). No new error chrome.
- Existing “invite-only” / expired-link copy unchanged.

---

## Tests

1. **Token contract** (`src/styles/themes/theme-discipline.test.ts`): extract `--*` custom properties from `glass.css` and `glass-dark.css`. The two sets must be identical. `tokens.css` names every required token in its comment contract; the test asserts both files define each named token. Fail if either file is missing a name or extra.
2. **Bootstrap mapping** (`src/lib/theme.test.ts`): call `resolveTheme` for stored `"light"` / `"dark"` / `null` / garbage × OS light/dark. Expected pairs are in “Theme mapping” above.
3. Existing Playwright `e2e/board.spec.ts` and `e2e/hydration.spec.ts` still pass. The new topbar must not break `data-id` / `data-lane` selectors.

No visual snapshots in v1.

---

## Out of scope

Animated aurora; mood-by-route or mood-by-SLA; per-account theme; a “System” toggle option; the designer’s flat theme; replacing shadcn; porting rail/catalog/SAP/VT CSS; rewriting DnD, filters, ETL, or auth; dark-mode `dark:` cleanup across shadcn primitives.

---

## Success

The board, login, project list, timeline, and card editor read as the designer’s light glass in light mode and as frosted dark glass in dark mode. Toggling does not flash the wrong field. Cards sit on lanes as a nearer plane. Existing board e2e still passes.
