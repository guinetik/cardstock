import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CardColorPicker } from "./card-color-picker";

test("the picker exposes named, pressable color choices and neutral", () => {
  const html = renderToStaticMarkup(
    <CardColorPicker value="blue" onChange={() => undefined} />,
  );
  expect(html).toContain("<fieldset");
  expect(html.match(/aria-pressed="/g)).toHaveLength(10);
  expect(html).toContain('aria-label="No color"');
  expect(html).toContain('<span class="sr-only">No color</span>');
  expect(html).toContain('aria-label="Blue"');
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(html).not.toContain('role="radio"');
});
