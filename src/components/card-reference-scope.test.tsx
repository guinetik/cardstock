import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CardReferenceScope } from "./card-reference-scope";

test("renders no detached preview until a scoped card link is hovered", () => {
  const html = renderToStaticMarkup(
    <div data-card-reference-scope="test">
      <a href="/c/123" data-card-reference="123">
        #123
      </a>
      <CardReferenceScope
        scope="test"
        cards={[{ external_id: "123", title: "Main card", summary: "Context" }]}
      />
    </div>,
  );

  expect(html).toContain('data-card-reference="123"');
  expect(html).not.toContain('role="tooltip"');
});
