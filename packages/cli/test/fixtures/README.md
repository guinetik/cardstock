# Legacy tracker fixtures

`legacy-boards.json` captures the Cardstock, Designer and Website board
configuration and tag mappings as inspected on 2026-09-06. These are vocabulary
and workflow definitions, without credentials, card content or board snapshots.
Tests construct synthetic Markdown, documentation and inert seed files around
them. No test needs the Staffeto wiki checkout or a remote board.

The migration preserves these configurations, including Designer's `int` to
`area` alias and audience rules. Mapping execution and board snapshot round trips
belong to the later sync integration; these fixtures do not establish that parity.

Validation retains the legacy rule engine's pre-normalization values and adds
strict YAML checking when a scheme is configured. Two deliberate stricter checks:
duplicate YAML keys are rejected, and required headings must appear as real
headings outside fenced code rather than as substrings in prose. Existing minimal
configurations retain lenient frontmatter parsing.
