import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CardReferenceText } from "./card-reference-text";

test("renders summary card references as board-local page links", () => {
  const html = renderToStaticMarkup(
    <p>
      <CardReferenceText boardPath="/p/demo/b/backlog">
        Follow #123 before #456.
      </CardReferenceText>
    </p>,
  );

  expect(html).toContain('href="/p/demo/b/backlog/c/123"');
  expect(html).toContain('data-card-reference="456"');
  expect(html).toContain("Follow ");
});
