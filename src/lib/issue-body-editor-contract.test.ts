import { describe, expect, test } from "bun:test";

const ROUTE = "src/app/p/[project]/b/[board]/c/[externalId]";

/**
 * Read a project file relative to the worktree root.
 *
 * @param path - Repository-relative file path.
 */
async function source(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe("issue body editor contract", () => {
  test("provides the browser-only editor controls and plugins", async () => {
    const editor = await source(`${ROUTE}/issue-body-editor.tsx`);

    expect(editor).toContain('data-testid="issue-body-editor"');
    expect(editor).toContain("headingsPlugin()");
    expect(editor).toContain("listsPlugin()");
    expect(editor).toContain("linkPlugin()");
    expect(editor).toContain("CodeToggle");
    expect(editor).toContain("InsertCodeBlock");
  });

  test("provides read, edit, save, cancel, and load-failure states", async () => {
    const panel = await source(`${ROUTE}/issue-body-panel.tsx`);

    expect(panel).toContain('data-testid="edit-issue-body"');
    expect(panel).toContain('data-testid="save-issue-body"');
    expect(panel).toContain("updateCardBody(cardId, draft)");
    expect(panel).toContain("Couldn’t open the editor.");
    expect(panel).toContain("ssr: false");
    expect(panel).toContain("Cancel");
  });

  test("uses the issue body panel without removing comments", async () => {
    const page = await source(`${ROUTE}/card-sheet.tsx`);

    expect(page).toContain("<IssueBodyPanel");
    expect(page).toContain("bodyMarkdown={issue.body}");
    expect(page).toContain("<IssueComments");
    expect(page.indexOf("<IssueBodyPanel")).toBeLessThan(
      page.indexOf("<IssueComments"),
    );
  });
});
