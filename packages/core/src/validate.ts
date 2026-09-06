import { parseFile } from "./parse";
import { validateFrontmatter } from "./schema";

export interface TrackerFile {
  name: string;
  text: string;
}
export interface Diagnostic {
  file: string;
  message: string;
}

/** Validate the same frontmatter contract the web importer consumes. */
export function validateTracker(files: TrackerFile[]) {
  const diagnostics: Diagnostic[] = [];
  const ids = new Map<number, string>();
  for (const file of files) {
    try {
      const parsed = parseFile(file.text);
      const { data } = validateFrontmatter(parsed.frontmatter, file.name);
      const previous = ids.get(data.id);
      if (previous)
        diagnostics.push({
          file: file.name,
          message: `Duplicate id ${data.id}; also in ${previous}`,
        });
      else ids.set(data.id, file.name);
      if (file.name !== `${data.id}.md`)
        diagnostics.push({
          file: file.name,
          message: `Filename must be ${data.id}.md to match frontmatter id`,
        });
    } catch (error) {
      diagnostics.push({
        file: file.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { ok: diagnostics.length === 0, files: files.length, diagnostics };
}
