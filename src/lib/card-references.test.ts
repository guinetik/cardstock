import { describe, expect, test } from "bun:test";
import {
  cardReferenceParts,
  linkCardReferencesInHtml,
  renderCardMarkdown,
} from "./card-references";

const BOARD = "/p/demo/b/backlog";

describe("card references", () => {
  test("finds numbered references in prose", () => {
    expect(cardReferenceParts("Blocked by #12, then revisit (#345).")).toEqual([
      { type: "text", value: "Blocked by " },
      { type: "reference", externalId: "12" },
      { type: "text", value: ", then revisit (" },
      { type: "reference", externalId: "345" },
      { type: "text", value: ")." },
    ]);
  });

  test("does not treat word suffixes or URL fragments as references", () => {
    expect(cardReferenceParts("release#12 https://example.test/#34")).toEqual([
      { type: "text", value: "release#12 https://example.test/#34" },
    ]);
  });

  test("links rendered prose but leaves existing links and code alone", () => {
    const html = renderCardMarkdown(
      "See #12, [already #13](/somewhere), and `#14`.\n\n```txt\n#15\n```",
      BOARD,
    );

    expect(html).toContain(
      'data-card-reference="12" href="/p/demo/b/backlog/c/12">#12</a>',
    );
    expect(html).toContain('<a href="/somewhere">already #13</a>');
    expect(html).toContain("<code>#14</code>");
    expect(html).toContain('<code class="language-txt">#15\n</code>');
    expect(html).not.toContain('data-card-reference="13"');
    expect(html).not.toContain('data-card-reference="14"');
    expect(html).not.toContain('data-card-reference="15"');
  });

  test("preserves protected HTML while linking neighboring text", () => {
    expect(
      linkCardReferencesInHtml(
        '<p>#1 <!-- keep #2 hidden --> <a href="#3">#3</a> #4</p>',
        BOARD,
      ),
    ).toBe(
      '<p><a class="paper-link" data-card-reference="1" href="/p/demo/b/backlog/c/1">#1</a> <!-- keep #2 hidden --> <a href="#3">#3</a> <a class="paper-link" data-card-reference="4" href="/p/demo/b/backlog/c/4">#4</a></p>',
    );
  });
});
