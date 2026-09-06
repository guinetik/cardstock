import { parseDocument } from "yaml";
import { parseFile } from "./parse";
import { validateFrontmatter } from "./schema";
import type { Scheme } from "./scheme";
import { validateScheme } from "./validate-scheme";

export interface TrackerFile {
  name: string;
  text: string;
}
export interface Diagnostic {
  file: string;
  message: string;
  code?: string;
  field?: string;
  reference?: string;
}

/** Validate the same frontmatter contract the web importer consumes. */
export function validateTracker(files: TrackerFile[], scheme?: Scheme) {
  const diagnostics: Diagnostic[] = [];
  const ids = new Map<number, string>();
  for (const file of files) {
    try {
      const parsed = parseFile(file.text);
      if (scheme) {
        const lines = file.text.split(/\r?\n/);
        const end = lines.findIndex(
          (line, i) => i > 0 && line.trim() === "---",
        );
        const yaml = parseDocument(lines.slice(1, end).join("\n"), {
          stringKeys: true,
        });
        const yamlErrors = [
          ...yaml.errors,
          ...yaml.warnings.filter(
            (warning) => warning.code === "TAG_RESOLVE_FAILED",
          ),
        ].map((error) => error.message);
        if (!yamlErrors.length) {
          try {
            // Resolve aliases as a compatibility gate, without using/coercing these values.
            yaml.toJS({ maxAliasCount: 100 });
          } catch (error) {
            yamlErrors.push(
              error instanceof Error ? error.message : String(error),
            );
          }
        }
        if (yamlErrors.length) {
          for (const message of yamlErrors)
            diagnostics.push({
              file: file.name,
              code: "invalid_yaml",
              field: "frontmatter",
              message: `Invalid YAML frontmatter: ${message}`,
            });
          continue;
        }
        diagnostics.push(
          ...validateScheme(file.name, parsed.frontmatter, parsed.body, scheme),
        );
      }
      const { data } = validateFrontmatter(parsed.frontmatter, file.name);
      const previous = ids.get(data.id);
      if (previous)
        diagnostics.push({
          file: file.name,
          code: "duplicate_id",
          field: "id",
          message: `Duplicate id ${data.id}; also in ${previous}`,
        });
      else ids.set(data.id, file.name);
      if (file.name !== `${data.id}.md`)
        diagnostics.push({
          file: file.name,
          code: "filename_id",
          field: "id",
          message: `Filename must be ${data.id}.md to match frontmatter id`,
        });
    } catch (error) {
      diagnostics.push({
        file: file.name,
        code: "invalid_frontmatter",
        field: "frontmatter",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { ok: diagnostics.length === 0, files: files.length, diagnostics };
}
