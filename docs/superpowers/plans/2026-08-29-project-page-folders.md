# Project page letterhead and section folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/p/[project]` reads as a letterhead plus a stack of quiet section folders (boards, people, concepts, settings) instead of one open dossier with leftover chrome.

**Architecture:** A presentational `ProjectSection` wraps each chapter in `.folder.folder--section`. The page renders a `.letterhead` (title, blurb, stats, stamp) then four sections. Binders stay only inside Boards. People is slips on folder stock. Settings reuses `.cta` / `.danger` as inner rows. No query or action changes.

**Tech Stack:** bun · Next.js App Router · React 19 · Paper CSS (`.folder`, `.binder`, `.roster`, `.cta`) · Playwright · `bun test`.

**Spec:** `docs/superpowers/specs/2026-08-29-project-page-folders-design.md`

## Global Constraints

- Home-page `.folder` on `/` does not change (Newsreader tab, hover-lift, binders inside).
- No new theme tokens. `bun test src/styles/themes/theme-discipline.test.ts` stays green without a contract change.
- Accessible folder headings are exactly `boards`, `people`, `concepts`, `settings` (count is a sibling, not inside the `h2`).
- Concepts omits itself when there are no boards. Boards, People, and Settings always render.
- Stamp lives only on the letterhead. Boards’ aside is Create board.
- Do not wire Download .zip or Delete this project. Copy and disabled buttons stay as they are.
- `bun run check` (biome + tsc) green at every commit.
- Commit messages: `feat:` / `fix:` / `docs:` / `test:` — short.

---

## File structure

| Path | Responsibility |
|---|---|
| `src/app/p/[project]/project-section.tsx` | One quiet section folder: tab `h2` + optional count, body, optional aside |
| `src/app/p/[project]/page.tsx` | Letterhead + four sections; same data loading |
| `src/app/p/[project]/project-people.tsx` | Slip list + invite only (no binder, no heading) |
| `src/styles/components/paper.css` | `.letterhead`, `.folder--section`, inner `.cta`/`.danger`; remove `.folder--open`, `.section-head`, `.roster-head` |
| `src/styles/themes/theme-discipline.test.ts` | Assert letterhead + section folder exist; hover-lift excludes `--section` |
| `e2e/management.spec.ts` | Four section headings + settings copy on `/p/demo` |
| `docs/paper.md` | Project page is letterhead + section folders |
| `docs/project-members.md` | Roster is slips in the People folder |

`TaxonomyEditor`, `CreateBoardDialog`, `InviteUserForm` are unchanged.

---

### Task 1: Failing tests for the new frame

**Files:**
- Modify: `e2e/management.spec.ts`
- Modify: `src/styles/themes/theme-discipline.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: assertions that fail until Tasks 2–3 land — headings `boards` / `people` / `concepts` / `settings` on `/p/demo`; CSS contains `.letterhead` and `.folder--section`; hover-lift selector excludes `.folder--section`

- [ ] **Step 1: Extend the project-page e2e**

In `e2e/management.spec.ts`, replace the invite test’s heading check and add a sibling test. Keep the invite/remove flow.

```ts
test("the project page lists members and invites someone without sending email", async ({
  page,
}) => {
  await dropMember(PROJECT_INVITED);
  try {
    await signIn(page);
    await page.goto("/p/demo");
    await expect(page.getByRole("heading", { name: "people" })).toBeVisible();
    await expect(
      page.getByText(OWNER.split("@")[0] ?? OWNER, { exact: true }),
    ).toBeVisible();

    await page.getByLabel("Email").fill(PROJECT_INVITED);
    await page.getByLabel("Display name").fill("Folder Invite");
    await page.getByLabel("Role", { exact: true }).selectOption("member");
    await page.getByRole("button", { name: "Invite user" }).click();
    await expect(page.getByRole("status")).toContainText("can now onboard");
    await expect(
      page.getByText("Folder Invite", { exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: `Remove ${PROJECT_INVITED} from Demo` })
      .click();
    await expect(page.getByText("Folder Invite", { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await dropMember(PROJECT_INVITED);
  }
});

test("the project page is a letterhead and four section folders", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/p/demo");
  await expect(page.getByRole("heading", { name: "Demo", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "boards", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "people", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "concepts", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "settings", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Take this project home" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Danger zone" })).toBeVisible();
});
```

- [ ] **Step 2: Add theme-discipline assertions**

In the `paper components` describe in `src/styles/themes/theme-discipline.test.ts` (the block that already uses `const css = COMPONENTS`), add:

```ts
  test("the project page is a letterhead and section folders", () => {
    expect(css).toContain(".letterhead");
    expect(css).toContain(".folder--section");
    expect(css).not.toContain(".folder--open");
    expect(css).not.toContain(".section-head");
    expect(css).toContain(
      ".folder:not(.folder--section):has(.folder-tab:is(:hover, :focus-visible))",
    );
  });
```

Keep the existing roster test (`.roster`, `.roster-slip`, `.roster-punch`, `.roster-you`).

- [ ] **Step 3: Run the unit test and confirm it fails**

Run: `bun test src/styles/themes/theme-discipline.test.ts`
Expected: FAIL — `.letterhead` / `.folder--section` missing, `.folder--open` still present.

- [ ] **Step 4: Commit**

```bash
git add e2e/management.spec.ts src/styles/themes/theme-discipline.test.ts
git commit -m "test: project page letterhead and section folders"
```

---

### Task 2: Paper CSS for letterhead and section folders

**Files:**
- Modify: `src/styles/components/paper.css`

**Interfaces:**
- Consumes: existing `.folder`, `.folder-tab`, `.folder-body`, `.folder-aside`, `.folder-stamp`, `.cta`, `.danger`
- Produces: `.letterhead`, `.letterhead-aside`, `.folder--section`, `.folder-count`, `.folder-tab-dot`, `.graph-board`; hover-lift scoped with `:not(.folder--section)`; `.folder--open`, `.section-head`, `.roster-head`, `.roster .binder-name` removed; `.roster { margin-top: 0 }`; `.folder--section .cta` / `.danger` as inner rows

- [ ] **Step 1: Scope folder hover-lift so section folders stay put**

Replace the three rules that lift any `.folder` on tab hover/active (currently around `.folder:has(.folder-tab:is(:hover, :focus-visible))` and `.folder:has(.folder-tab:active)`) with:

```css
  .folder-tab:is(:hover, :focus-visible) {
    padding-top: 0.7rem;
  }
  .folder--section .folder-tab:is(:hover, :focus-visible) {
    padding-top: 0.5rem;
  }
  .folder:not(.folder--section):has(.folder-tab:is(:hover, :focus-visible)) {
    translate: 0 var(--motion-rise);
  }
  .folder:not(.folder--section):has(.folder-tab:is(:hover, :focus-visible))
    .folder-body {
    box-shadow: var(--shadow-lift);
  }
  .folder:not(.folder--section):has(.folder-tab:active) {
    translate: 0 var(--motion-press-y);
  }
```

Leave `.folder-tab:focus-visible` as it is.

- [ ] **Step 2: Replace `.folder--open` with letterhead + `.folder--section`**

Delete the block titled `the folder, opened` (`.folder--open .folder-tab`, `.folder--open .folder-tab > h1`, `.folder--open .folder-body`). Keep `.binder--wide` and the tally/links rules that follow it.

Insert immediately before `.binder--wide`:

```css
  /*
   * ------------------------------------------------- the project page
   * The project is a letterhead (name, blurb, stamp). Each chapter below
   * is a quiet section folder — same manila, Plex tab, no hover-lift.
   */
  .letterhead {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem 1.5rem;
    align-items: start;
    margin: 0 0 1.75rem;
  }
  .letterhead h1 {
    font-size: 1.85rem;
    line-height: 1.15;
  }
  .letterhead-aside {
    display: flex;
    justify-content: flex-end;
    padding-top: 0.15rem;
  }
  .folder--section + .folder--section {
    margin-top: 1.25rem;
  }
  .folder--section .folder-tab {
    font-family: var(--font-sys);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: none;
    cursor: default;
  }
  .folder--section .folder-tab > h2 {
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
    text-transform: none;
  }
  .folder-tab-dot {
    color: var(--color-grey-faint);
  }
  .folder-count {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: var(--color-grey);
  }
  .folder--section .folder-body {
    padding: 1.1rem 1.25rem 1.25rem;
  }
  .folder--section .folder-aside {
    justify-content: flex-end;
  }
  .graph-board {
    margin: 0 0 0.45rem;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-grey);
  }
  .graph-board + .graph {
    margin-top: 0;
  }
```

- [ ] **Step 3: Roster lives inside a folder; drop binder-head chrome**

Replace `.roster { margin-top: 1.75rem; }` with `.roster { margin-top: 0; }`.

Delete `.roster-head` and `.roster .binder-name` rules.

- [ ] **Step 4: Settings slips are inner rows, not page-width heroes**

After the existing `.cta-note` rule, add:

```css
  .folder--section .cta,
  .folder--section .danger {
    margin: 0;
    padding: 0.35rem 0 0.85rem;
    background: transparent;
    border: 0;
    box-shadow: none;
    border-radius: 0;
  }
  .folder--section .danger {
    padding-top: 1rem;
    border-top: 1px solid var(--border-strong);
  }
  .folder--section .cta-title {
    font-size: 18px;
  }
```

- [ ] **Step 5: Remove `.section-head`**

Delete `.section-head`, `.section-head > h2`, and `.section-head > .count`.

- [ ] **Step 6: Letterhead stacks on small screens**

In `@media (max-width: 40rem)`, add next to the existing `.folder-body` collapse:

```css
  .letterhead {
    grid-template-columns: minmax(0, 1fr);
  }
  .letterhead-aside {
    justify-content: flex-start;
  }
```

- [ ] **Step 7: Run theme-discipline**

Run: `bun test src/styles/themes/theme-discipline.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/styles/components/paper.css
git commit -m "feat: letterhead and quiet section folders"
```

---

### Task 3: ProjectSection, page stack, and roster slips

**Files:**
- Create: `src/app/p/[project]/project-section.tsx`
- Modify: `src/app/p/[project]/page.tsx`
- Modify: `src/app/p/[project]/project-people.tsx`

**Interfaces:**
- Consumes: `ProjectSection` as defined below; existing `ProjectPeople` props except it no longer owns a heading
- Produces: `ProjectSection({ id, title, count?, empty?, aside?, children })` — `title` is the `h2` text (`boards` | `people` | `concepts` | `settings`); `count` is digits only (e.g. `"2"`)

- [ ] **Step 1: Add `ProjectSection`**

Create `src/app/p/[project]/project-section.tsx`:

```tsx
import type { ReactNode } from "react";

/** One chapter of the project page: a quiet folder with a Plex tab. */
export function ProjectSection({
  id,
  title,
  count,
  empty = false,
  aside,
  children,
}: {
  id: string;
  title: string;
  count?: string;
  empty?: boolean;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`folder folder--section${empty ? " folder--empty" : ""}`}
      aria-labelledby={id}
    >
      <div className="folder-tab">
        <h2 id={id}>{title}</h2>
        {count != null && (
          <>
            <span className="folder-tab-dot" aria-hidden="true">
              ·
            </span>
            <span className="folder-count">{count}</span>
          </>
        )}
      </div>
      <div className="folder-body">
        <div className="min-w-0">{children}</div>
        {aside ? <div className="folder-aside">{aside}</div> : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Strip binder chrome from `ProjectPeople`**

Replace the component so it renders slips (and the invite) only. Remove `plural`, the outer `section.binder.roster`, rivets, and `roster-head`. Keep `aria-label="People"` on the list.

```tsx
import { removeMembership } from "@/app/users/actions";
import { InviteUserForm } from "@/app/users/invite-user-form";

/** One row on the project roster: allowlist identity plus project role. */
export type ProjectPerson = {
  memberId: string;
  email: string;
  displayName: string | null;
  role: string;
};

/**
 * Who can open this folder, as punched slips on the People section's stock.
 * The owner invites on the blank sheet at the foot; removing someone leaves
 * them on the allowlist.
 */
export function ProjectPeople({
  projectId,
  projectName,
  people,
  currentMemberId,
  canInvite,
}: {
  projectId: string;
  projectName: string;
  people: ProjectPerson[];
  currentMemberId: string;
  canInvite: boolean;
}) {
  return (
    <div className="roster">
      <ul className="roster-slips" aria-label="People">
        {people.map((person) => {
          const name = person.displayName ?? person.email;
          const you = person.memberId === currentMemberId;
          return (
            <li key={person.memberId} className="roster-slip">
              <span className="roster-punch" aria-hidden="true" />
              <div className="roster-who">
                <span className="roster-name">
                  {name}
                  {you && <span className="roster-you">you</span>}
                </span>
                {person.displayName && (
                  <span className="roster-mail">{person.email}</span>
                )}
              </div>
              <div className="roster-meta">
                <span className="stat stat--flat">{person.role}</span>
                {canInvite && !you && (
                  <form action={removeMembership}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input
                      type="hidden"
                      name="memberId"
                      value={person.memberId}
                    />
                    <button
                      type="submit"
                      className="paper-link paper-link--danger"
                      aria-label={`Remove ${person.email} from ${projectName}`}
                    >
                      Remove
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {canInvite && (
        <InviteUserForm
          variant="slip"
          projects={[{ id: projectId, name: projectName }]}
          lockedProjectId={projectId}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Restructure `page.tsx`**

Keep the data-loading half of `src/app/p/[project]/page.tsx` unchanged (types, `KIND_STAT`, `plural`, the default export’s queries). Change only the import list and the `return`.

Add:

```tsx
import { ProjectSection } from "./project-section";
```

Replace the `return (` through the closing `</main>` with:

```tsx
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <Link
        href="/"
        className="eyebrow mb-4 inline-block hover:text-[var(--color-ink)]"
      >
        ← Projects
      </Link>

      <header className="letterhead">
        <div className="min-w-0">
          <h1>{project.name}</h1>
          {project.description ? (
            <p className="folder-blurb">{project.description}</p>
          ) : (
            <p className="folder-blurb text-[var(--color-grey-faint)]">
              No description.
            </p>
          )}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span className="stat stat--flat stat--ink">
              {plural(boards.length, "board", "boards")}
            </span>
            <span className="stat stat--flat">
              {plural(cardCount, "card", "cards")}
            </span>
            {onFile > 0 && (
              <span className="stat stat--flat stat--faint">
                {onFile} from .md files
              </span>
            )}
          </p>
        </div>
        <div className="letterhead-aside">
          {cardCount > 0 ? (
            <span className="folder-stamp" aria-hidden="true">
              {plural(cardCount, "card", "cards")}
              <br />
              filed
            </span>
          ) : (
            <span
              className="folder-stamp folder-stamp--faint"
              aria-hidden="true"
            >
              nothing
              <br />
              filed
            </span>
          )}
        </div>
      </header>

      <ProjectSection
        id="boards-heading"
        title="boards"
        count={String(boards.length)}
        empty={boards.length === 0}
        aside={
          <CreateBoardDialog
            projectId={project.id}
            projectSlug={project.slug}
          />
        }
      >
        {boards.length > 0 ? (
          <ul className="binders" aria-label="Boards">
            {boards.map((board) => {
              const lanes = [...(board.lanes ?? [])].sort(
                (a, b) => a.position - b.position,
              );
              const cards = board.cards ?? [];
              const live = cards.filter((c) => !c.archived_at);
              const archived = cards.length - live.length;
              const byLane = new Map<string, number>();
              for (const c of live) {
                if (c.lane_id)
                  byLane.set(c.lane_id, (byLane.get(c.lane_id) ?? 0) + 1);
              }
              const boardHref = `${href}/b/${board.slug}`;
              return (
                <li key={board.id} className="binder binder--wide">
                  <span className="binder-rivets" aria-hidden="true" />
                  <h2 className="binder-name">
                    <Link href={boardHref} className="binder-open">
                      {board.name}
                    </Link>
                    <code className="graph-key ml-2">{board.slug}</code>
                  </h2>
                  <p className="binder-tally">
                    {lanes
                      .filter((l) => l.kind !== "archive")
                      .map((l) => (
                        <span
                          key={l.id}
                          className={`stat ${KIND_STAT[l.kind]}`}
                        >
                          {l.name}{" "}
                          <b className="font-medium">
                            {byLane.get(l.id) ?? 0}
                          </b>
                        </span>
                      ))}
                    {archived > 0 && (
                      <span className="stat stat--faint">
                        archived <b className="font-medium">{archived}</b>
                      </span>
                    )}
                    {cards.length === 0 && (
                      <span className="stat stat--flat stat--faint">
                        no cards yet
                      </span>
                    )}
                  </p>
                  <div className="binder-foot">
                    <span className="binder-count">
                      {plural(cards.length, "card", "cards")}
                    </span>
                    <span className="binder-links">
                      <Link
                        href={`${boardHref}/cockpit`}
                        className="binder-cockpit paper-link"
                        aria-label={`${board.name} cockpit`}
                      >
                        Take stock
                      </Link>
                      <a
                        href={`${boardHref}/export`}
                        className="binder-cockpit paper-link"
                        aria-label={`Export ${board.name} as CSV`}
                      >
                        Export CSV
                      </a>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="binders-empty">
            No boards yet. A new board starts with Unsorted, Now, Next, Done
            and Archive lanes; work lanes can be renamed or added on the board
            itself.
          </p>
        )}
      </ProjectSection>

      <ProjectSection
        id="people-heading"
        title="people"
        count={String(people.length)}
      >
        <ProjectPeople
          projectId={project.id}
          projectName={project.name}
          people={people}
          currentMemberId={member.id}
          canInvite={member.role === "owner"}
        />
      </ProjectSection>

      {boards.length > 0 && (
        <ProjectSection id="concepts-heading" title="concepts">
          <div className="space-y-8">
            {boards.map((board) => {
              const taxonomy = (
                (groups ?? []) as Array<TaxonomyGroup & { board_id: string }>
              )
                .filter((group) => group.board_id === board.id)
                .map(({ board_id: _boardId, ...group }, i) => ({
                  ...group,
                  hue: markHue(i),
                  tags: [...(group.tags ?? [])].sort((a, b) =>
                    a.name.localeCompare(b.name),
                  ),
                }));
              return (
                <div key={board.id}>
                  {boards.length > 1 && (
                    <p className="graph-board">{board.name}</p>
                  )}
                  <TaxonomyEditor
                    boardId={board.id}
                    boardName={board.name}
                    groups={taxonomy}
                  />
                </div>
              );
            })}
          </div>
        </ProjectSection>
      )}

      <ProjectSection id="settings-heading" title="settings">
        <section className="cta" aria-labelledby="download-heading">
          <div className="min-w-0">
            <h2 id="download-heading" className="cta-title">
              Take this project home
            </h2>
            <p className="cta-body">
              Every card as a markdown file, one per sheet, with the board
              decisions written into its frontmatter. Nothing here is locked in.
            </p>
          </div>
          <button
            type="button"
            className="cta-button"
            aria-disabled="true"
            title="Not available yet"
          >
            Download .zip
          </button>
          <span className="cta-note">Coming soon</span>
        </section>
        <section className="danger" aria-labelledby="danger-heading">
          <div className="min-w-0">
            <h2 id="danger-heading" className="cta-title">
              Danger zone
            </h2>
            <p className="cta-body">
              Deleting a project removes its boards, lanes and every card in
              them. The markdown files you have exported are not touched.
            </p>
          </div>
          <button
            type="button"
            className="cta-button cta-button--danger"
            aria-disabled="true"
            title="Not available yet"
          >
            Delete this project
          </button>
          <span className="cta-note">Owners only · coming soon</span>
        </section>
      </ProjectSection>
    </main>
  );
```

- [ ] **Step 4: Check**

Run: `bun run check`
Expected: PASS (biome + tsc).

Run: `bun test src/styles/themes/theme-discipline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/p/[project]/project-section.tsx src/app/p/[project]/page.tsx src/app/p/[project]/project-people.tsx
git commit -m "feat: project page as letterhead and section folders"
```

---

### Task 4: Docs

**Files:**
- Modify: `docs/paper.md` (the folder section, project-page paragraph)
- Modify: `docs/project-members.md` (roster paragraph)

**Interfaces:**
- Consumes: the shipped layout from Task 3
- Produces: docs that match the page

- [ ] **Step 1: Rewrite the project-page paragraph in `docs/paper.md`**

Replace the paragraph that begins “The project page is the same folder laid open” with:

```
The project page is a **letterhead** plus a stack of section folders
(`.folder--section`). The letterhead is the project name in Newsreader, the
blurb, the counts as `.stat`s, and the `.folder-stamp` in the margin — the
stamp is written once. Each chapter below is its own manila file with a quiet
Plex tab (`boards`, `people`, `concepts`, `settings`); the tab does not lift
the folder. Binders live only in Boards — wide `.binder`s with lane `.stat`s,
*Take stock*, and *Export CSV*, and *New board* in the aside. People is punched
`.roster-slip`s on that folder's stock, last row blank for the invite.
Concepts is the **concept graph** (`.graph`): each group a `.graph-node` with
highlighter on its spine, tags as `.mark`s on a ruled trunk. Settings holds
the two asks as inner rows, same shape and opposite pens: `.cta` to take the
project home as markdown, `.danger` to delete it.
```

Leave the projects-list folder paragraph (closed `.folder` on `/`) unchanged.

- [ ] **Step 2: Update `docs/project-members.md`**

Replace the paragraph that begins “On the project page the roster is a binder” with:

```
On the project page the roster is punched slips (`.roster`) inside the People
folder: name as a tab, email in mono, role in the margin, *Remove* to take
someone off this folder. The blank row at the foot is the invite.
```

- [ ] **Step 3: Commit**

```bash
git add docs/paper.md docs/project-members.md
git commit -m "docs: project page letterhead and section folders"
```

---

## Self-review

1. **Spec coverage:** Letterhead, four folders, Concepts omitted when empty, stamp once, binders only in Boards, People without binder chrome, Settings inner rows, no new tokens, e2e headings, paper.md + project-members.md — each has a task.
2. **Placeholders:** none.
3. **Types:** `ProjectSection` props (`id`, `title`, `count?: string`, `empty?`, `aside?`, `children`) are the same in Task 2 CSS class names and Task 3.
