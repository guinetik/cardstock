import { expect, test } from "bun:test";
import { jsonSchema } from "./schema";

/** docs/frontmatter.schema.json is generated; this fails when it goes stale. Regenerate with `bun run etl:schema`. */
test("docs/frontmatter.schema.json matches the zod contract", async () => {
  const onDisk = JSON.parse(
    await Bun.file("docs/frontmatter.schema.json").text(),
  );
  expect(onDisk).toEqual(jsonSchema());
});
