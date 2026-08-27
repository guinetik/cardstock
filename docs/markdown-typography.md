# Markdown typography

Card bodies are rendered with Tailwind Typography (`.prose`). That plugin colours copy with slate-700 / near-black `--tw-prose-*` variables, and `dark:prose-invert` only swaps them when a `.dark` ancestor exists.

This app never adds `.dark`. Theme is `data-theme="paper"` or `data-theme="paper-night"`. `dark:prose-invert` is therefore a no-op, and markdown at night would be unreadable without a remap.

## Fix

`src/styles/components/paper.css` remaps `--tw-prose-*` onto paper tokens (`--color-ink2`, `--color-ink-strong`, `--pen-blue`, `--border-hairline`, …) under both `data-theme` values. The remap is **unlayered**: the typography plugin writes those variables on `.prose` outside any `@layer`, so an `@layer components` rule never wins.

Light and dark then follow the same contract as the rest of the UI.

Do not reintroduce `dark:prose-invert`. Do not flip `@custom-variant dark` onto `data-theme`; that would wake dormant shadcn `dark:` classes and fight the paper map.

## Page shells

`.paper-card` deepens its shadow under the pointer. That is for kanban tiles, not full-page shells. Card detail uses `.paper-card--static` so the article does not react while you read it.

See `docs/paper.md` for the system these tokens come from.
