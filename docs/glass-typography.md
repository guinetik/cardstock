# Glass typography (markdown)

Card bodies are rendered with Tailwind Typography (`.prose`). That plugin colours copy with slate-700 / near-black `--tw-prose-*` variables, and `dark:prose-invert` only swaps them when a `.dark` ancestor exists.

This app never adds `.dark`. Theme is `data-theme="glass"` or `data-theme="glass-dark"`. `dark:prose-invert` is therefore a no-op, and markdown on dark glass is unreadable.

## Fix

`src/styles/components/cards.css` remaps `--tw-prose-*` onto glass tokens (`--color-ink`, `--color-ink-strong`, `--color-brand`, `--border-divider`, …) under both `data-theme` values. The remap is **unlayered**: the typography plugin writes those variables on `.prose` outside any `@layer`, so an `@layer components` rule never wins.

Light and dark then follow the same contract as the rest of the UI.

Do not reintroduce `dark:prose-invert`. Do not flip `@custom-variant dark` onto `data-theme`; that would wake dormant shadcn `dark:` classes and fight the glass map.

## Page shells

`.glass-card` lifts on hover. That is for kanban tiles, not full-page shells. Card detail uses `.glass-card--static` so the article does not jump under the pointer.
