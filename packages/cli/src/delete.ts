import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { preview } from "./preview";
import { executeSync } from "./sync-execute";

export const DELETE_HELP = `Usage: cardstock delete <id> [<id> ...] [--dry-run] [--json]
       cardstock delete --file <path> [--dry-run] [--json]
                         [--config <file>] [--remote <url>]
                         [--ours <id>] [--theirs <id>]

Delete only the named cards, using their saved identity baseline. The list file
contains one positive card ID per line; blank lines and # comments are ignored.
Preview first. Concurrent edits are conflicts: ours means delete, theirs means
keep the hosted card. Missing tracker files never request a deletion.
Local originals remain in .cardstock/ backups beside the recovery journal.
Interrupted operations use cardstock sync --resume (or --abort).`;

export async function deleteCards(args: string[], cwd: string) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      file: { type: "string" },
      config: { type: "string" },
      remote: { type: "string" },
      json: { type: "boolean" },
      "dry-run": { type: "boolean" },
      ours: { type: "string", multiple: true },
      theirs: { type: "string", multiple: true },
    },
  });
  if (values.file && positionals.length)
    throw new Error("Choose card IDs or --file, not both");
  const ids = values.file
    ? (await readFile(path.resolve(cwd, values.file), "utf8"))
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
    : positionals;
  if (
    !ids.length ||
    ids.length > 1000 ||
    ids.some(
      (id) => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)),
    )
  )
    throw new Error(
      "Specify 1–1000 positive, safe integer card IDs (one per line with --file)",
    );
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate deletion ID");
  const forwarded: string[] = [];
  for (const key of ["config", "remote"] as const)
    if (values[key]) forwarded.push(`--${key}`, values[key]);
  for (const side of ["ours", "theirs"] as const)
    for (const id of values[side] ?? []) {
      if (!ids.includes(id))
        throw new Error(
          `--${side} must name a whole card selected for deletion`,
        );
      forwarded.push(`--${side}`, id);
    }
  if (values.json) forwarded.push("--json");
  return values["dry-run"]
    ? preview("sync", forwarded, cwd, ids)
    : executeSync(forwarded, cwd, ids);
}
