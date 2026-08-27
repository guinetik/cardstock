import { writeFile } from "node:fs/promises";
import { jsonSchema } from "./schema";

const out = "docs/frontmatter.schema.json";
await writeFile(out, `${JSON.stringify(jsonSchema(), null, 2)}\n`);
console.log(`wrote ${out}`);
