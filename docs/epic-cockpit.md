# Epic cockpit

The cockpit is the board's portfolio view: `/p/<project>/b/<board>/cockpit`.
Selecting an epic opens its dedicated flight-plan route at
`/p/<project>/b/<board>/cockpit/<epic-id>`, keeping the fleet overview and epic
detail distinct. It groups cards by their tracker-owned `epic` value and translates task detail
into a small set of plain delivery signals.

## Task lights

The first matching state wins:

1. **Delivered** — a done lane or shipped/done status.
2. **Blocked** — blocked status, a waiting lane, or a non-empty `needs` value.
3. **Late** — an unfinished task whose target date has passed.
4. **Moving** — wip/built/handed status or a built lane.
5. **Queued** — all other unfinished work.

Colour is never the only cue: task squares also carry a mark, accessible name,
focus tooltip, and direct link to the card.

## Outlook

Epic outcome, owner label, planned start, committed date, priority, and owner
confidence are app-owned. Epic names remain markdown-owned and are not renamed
in the cockpit.

Effort uses the existing Low/Medium/High values as weights 1/3/5. A likely
landing appears only when at least 70% of remaining tasks have effort and two
known-effort tasks landed in the last six weeks. Otherwise the cockpit says it
does not have enough history. It never fills missing estimates with guesses.

The primary labels are **On track**, **Needs attention**, **Date at risk**, and
**Planning needed**. Reasons are always shown in ordinary language. Owner
confidence does not override the calculated outlook; disagreement is called
out explicitly.

## History and tracker round-trip

The migration seeds one truthful work-left baseline per epic. Database triggers
record the latest state for each UTC day after relevant card changes. Earlier
burndown is not reconstructed.

Cards gain the optional app-owned `planned_start` frontmatter key. Import seeds
it when unset and export writes it alongside `target`. An importer creates epic
metadata records as new source epic names appear. No organization-specific
names, statuses, or workflow assumptions are built into the feature.
