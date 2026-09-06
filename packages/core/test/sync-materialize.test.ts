import { describe, expect, test } from "bun:test";
import { agreesWithIntent, type Baseline, materializeSync } from "../src";

const sheet = `---
id: 1
title: 'Example' # keep title comment
status: backlog # keep status comment
epic: Platform
area: UI
tags: [bug]
# custom documentation
custom:
  owner: original
  sequence: [a, b]
obsolete: keep
---
# My local heading

## Ask
Preserve this content.
`;
const vocabulary = { tagGroups: [{ key: "kind", tags: [{ key: "bug" }] }] };
const scope = {
  remote: "https://example.test",
  project: "demo",
  board: "backlog",
  tracker: "tracker",
  mapping: "{}",
};
const base: Baseline = {
  version: 1,
  scope,
  etag: "v1",
  cards: [{ file: "1.md", externalId: "1", revision: "r1", markdown: sheet }],
};
function materialize(
  local = sheet,
  remote = sheet,
  baseline: Baseline | undefined = base,
) {
  return materializeSync({
    local: [{ file: "1.md", markdown: local }],
    remote: [{ externalId: "1", revision: "r2", markdown: remote }],
    baseline,
    vocabulary,
  });
}

describe("sync materialization", () => {
  test("unchanged cards require no intent; upload preserves remote layout", () => {
    expect(materialize()).toEqual([]);
    const local = sheet.replace("owner: original", "owner: local");
    const remote = sheet.replace("title: 'Example'", 'title: "Example"');
    const [intent] = materialize(local, remote);
    expect(intent.after.local).toBe(local);
    expect(intent.after.remote).toBe(
      remote.replace("owner: original", "owner: local"),
    );
    expect(intent.writeLocal).toBe(false);
    expect(intent.writeRemote).toBe(true);
    expect(intent.before.remote?.revision).toBe("r2");
  });
  test("different fields merge both ways, preserving comments and newline style", () => {
    const local = sheet
      .replace("owner: original", "owner: local")
      .replaceAll("\n", "\r\n");
    const remote = sheet.replace("status: backlog", "status: held");
    const [intent] = materialize(local, remote);
    expect(intent.after.local).toBe(
      local.replace("status: backlog", "status: held"),
    );
    expect(intent.after.remote).toBe(
      remote.replace("owner: original", "owner: local"),
    );
    expect([intent.writeLocal, intent.writeRemote]).toEqual([true, true]);
    expect(
      agreesWithIntent(
        intent,
        { file: "1.md", markdown: intent.after.local },
        { externalId: "1", revision: "r3", markdown: intent.after.remote },
        vocabulary,
      ),
    ).toBe(true);
  });
  test("body downloads preserve the local heading and untouched frontmatter", () => {
    const remote = sheet
      .replace("# My local heading", "# Different redundant heading")
      .replace("Preserve this content.", "Remote body.\n\n- Extra detail.");
    const [intent] = materialize(sheet, remote);
    expect(intent.after.local).toBe(
      sheet.replace(
        "Preserve this content.",
        "Remote body.\n\n- Extra detail.",
      ),
    );
    expect(intent.after.remote).toBe(remote);
  });
  test("added, removed and null-valued unknown keys remain distinct", () => {
    for (const value of [
      "",
      "obsolete: null\n",
      "obsolete: null\nadded: { nested: [1, false] }\n",
    ]) {
      const remote = sheet.replace("obsolete: keep\n", value);
      expect(materialize(sheet, remote)[0].after.local).toBe(remote);
    }
  });
  test("identical edits produce a no-write intent for verified baseline advancement", () => {
    const changed = sheet.replace("status: backlog", "status: held");
    const [intent] = materialize(changed, changed);
    expect([intent.writeLocal, intent.writeRemote]).toEqual([false, false]);
  });
  test("block scalars, empty nulls and changed collection shapes preserve surrounding fields", () => {
    for (const original of [
      "obsolete:\n",
      "obsolete: |\n  first\n  second\n",
      "obsolete: [a, b]\n",
    ]) {
      const initial = sheet.replace("obsolete: keep\n", original);
      const baseline = {
        ...base,
        cards: [{ ...base.cards[0], markdown: initial }],
      };
      const updated = initial.replace(
        original,
        "obsolete: { nested: [a, false] }\n",
      );
      expect(materialize(initial, updated, baseline)[0].after.local).toBe(
        updated,
      );
    }
  });
  test("quoted unknown keys and comments beside untouched nested values survive", () => {
    const initial = sheet.replace(
      "obsolete: keep",
      "'odd:key': keep\n# leave this comment\nuntouched: { a: true }",
    );
    const baseline = {
      ...base,
      cards: [{ ...base.cards[0], markdown: initial }],
    };
    const updated = initial.replace("'odd:key': keep", "'odd:key': changed");
    expect(materialize(initial, updated, baseline)[0].after.local).toBe(
      updated,
    );
  });
  test("empty body and absent trailing newline keep the target layout", () => {
    const initial =
      sheet.slice(0, sheet.indexOf("# My local heading")) +
      "# My local heading";
    const baseline = {
      ...base,
      cards: [{ ...base.cards[0], markdown: initial }],
    };
    expect(
      materialize(initial, `${initial}\nNew body.`, baseline)[0].after.local,
    ).toBe(`${initial}\nNew body.`);
    const noNewline = sheet.trimEnd();
    const secondBase = {
      ...base,
      cards: [{ ...base.cards[0], markdown: noNewline }],
    };
    expect(
      materialize(
        noNewline,
        noNewline.replace("Preserve this content.", "New body."),
        secondBase,
      )[0].after.local.endsWith("New body."),
    ).toBe(true);
  });
  test("one-sided creation and missing-file restoration retain original bytes", () => {
    const remote = base.cards;
    const [restore] = materializeSync({
      local: [],
      remote,
      baseline: base,
      vocabulary,
    });
    expect(restore.before.local).toBeNull();
    expect(restore.after.local).toBe(sheet);
    expect(restore.writeRemote).toBe(false);
    const [upload] = materializeSync({
      local: [{ file: "1.md", markdown: sheet }],
      remote: [],
      vocabulary,
    });
    expect(upload.before.remote).toBeNull();
    expect(upload.writeRemote).toBe(true);
  });
  test("conflicts, missing remote cards and first-contact disagreements cannot materialize", () => {
    expect(() =>
      materialize(
        sheet.replace("obsolete: keep", "obsolete: local"),
        sheet.replace("obsolete: keep", "obsolete: remote"),
      ),
    ).toThrow(/conflict/);
    expect(() =>
      materializeSync({ local: [], remote: [], baseline: base, vocabulary }),
    ).toThrow(/conflict/);
    expect(() =>
      materializeSync({
        local: [{ file: "1.md", markdown: sheet }],
        remote: [
          {
            externalId: "1",
            revision: "r2",
            markdown: sheet.replace("status: backlog", "status: held"),
          },
        ],
        vocabulary,
      }),
    ).toThrow(/conflict/);
  });
  test("canonical aliases cause no format-only writes", () => {
    expect(
      materialize(sheet, sheet.replace("tags: [bug]", "tags: [kind:bug]")),
    ).toEqual([]);
  });
  test("anchors are refused when editing YAML, not silently flattened", () => {
    const anchored = sheet.replace(
      "obsolete: keep",
      "obsolete: &label keep\ncopy: *label",
    );
    const baseline = {
      ...base,
      cards: [{ ...base.cards[0], markdown: anchored }],
    };
    expect(() =>
      materialize(
        anchored,
        anchored.replace("status: backlog", "status: held"),
        baseline,
      ),
    ).toThrow(/anchors/);
  });
  test("verification rejects wrong identities and unplanned outcome changes", () => {
    const [intent] = materialize(
      sheet.replace("obsolete: keep", "obsolete: local"),
    );
    expect(
      agreesWithIntent(
        intent,
        { file: "2.md", markdown: intent.after.local },
        { externalId: "1", revision: "r3", markdown: intent.after.remote },
        vocabulary,
      ),
    ).toBe(false);
    expect(
      agreesWithIntent(
        intent,
        { file: "1.md", markdown: sheet },
        { externalId: "1", revision: "r3", markdown: intent.after.remote },
        vocabulary,
      ),
    ).toBe(false);
  });
});
