import { lstat, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  type Config,
  legacyConfigSchema,
  mappingSchema,
  parseConfig,
} from "@cardstock/core";

export const INIT_HELP = `Usage: cardstock init --project <slug> --board <slug> [--dir tracker] [--remote <url>]
       cardstock init --from <board.json> [--remote <url>]

  --out <file>       Destination (default: cardstock.json in this directory).
  --dry-run          Preview the configuration without writing files.
  --json             Emit a structured result, including the configuration and notes.

Import resolves legacy paths and embeds the scheme and mapping.
An existing destination is never replaced. Seed SQL is referenced, never executed.`;

function relativeTo(directory: string, target: string): string {
  const relative = path.relative(directory, target);
  if (path.isAbsolute(relative))
    throw new Error(
      `Cannot make ${target} portable relative to ${directory}; choose an output on the same drive.`,
    );
  return relative.split(path.sep).join("/") || ".";
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Cannot read JSON from ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function requirePath(file: string, kind: "file" | "directory") {
  const info = await stat(file);
  if (!(kind === "file" ? info.isFile() : info.isDirectory()))
    throw new Error(`Expected a ${kind}: ${file}`);
}

/** Legacy scheme_doc is repository-relative; find its existing ancestor base. */
async function resolveSchemeDoc(
  root: string,
  reference: string,
): Promise<string> {
  let directory = root;
  while (true) {
    const candidate = path.resolve(directory, reference);
    try {
      await requirePath(candidate, "file");
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = path.dirname(directory);
    if (directory === parent || path.isAbsolute(reference)) break;
    directory = parent;
  }
  throw new Error(
    `Cannot resolve scheme.scheme_doc '${reference}' from ${root} or its ancestors. Restore the referenced document or correct the legacy configuration.`,
  );
}

export async function init(args: string[], cwd: string): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      project: { type: "string" },
      board: { type: "string" },
      dir: { type: "string" },
      remote: { type: "string" },
      from: { type: "string" },
      out: { type: "string" },
      "dry-run": { type: "boolean" },
      json: { type: "boolean" },
    },
  });
  if (
    values.from &&
    (values.project !== undefined ||
      values.board !== undefined ||
      values.dir !== undefined)
  ) {
    throw new Error(
      "--from cannot be combined with --project, --board or --dir; identity and tracker come from the legacy configuration.",
    );
  }
  const destination = path.resolve(cwd, values.out ?? "cardstock.json");
  const directory = path.dirname(destination);
  // lstat also protects a dangling symlink; exclusive creation closes the race.
  try {
    await lstat(destination);
    throw new Error(
      `Destination already exists: ${destination}. Choose --out <new-file>; init never replaces configuration.`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await requirePath(directory, "directory");
  const notes: string[] = [];
  let config: Config;
  if (values.from) {
    const source = path.resolve(cwd, values.from);
    const legacy = legacyConfigSchema.parse(await readJson(source));
    const root = path.dirname(source);
    const tracker = path.resolve(root, legacy.tracker);
    const seed = path.resolve(root, legacy.seed);
    const mapping = mappingSchema.parse(
      await readJson(path.resolve(root, legacy.mapping)),
    );
    await requirePath(tracker, "directory");
    await requirePath(seed, "file");
    const scheme = { ...legacy.scheme };
    notes.push(
      "Legacy area/epic lists are suggestions, not validation constraints. Audience rules are retained as metadata only: use explicit audience: all or internal; tags and epic names never set audience.",
    );
    if (scheme.scheme_doc) {
      const doc = await resolveSchemeDoc(root, scheme.scheme_doc);
      scheme.scheme_doc = relativeTo(directory, doc);
      notes.push(
        `Resolved scheme_doc to ${doc}; saved relative to the new configuration.`,
      );
    }
    config = parseConfig({
      version: 1,
      project: legacy.project,
      board: legacy.board,
      tracker: relativeTo(directory, tracker),
      scheme,
      mapping,
      provisioning: { seed: relativeTo(directory, seed) },
      ...(legacy.$comment !== undefined ? { $comment: legacy.$comment } : {}),
      ...(values.remote ? { remote: values.remote } : {}),
    });
    notes.push(
      `Seed ${seed} is retained as a provisioning/recovery reference; no SQL is executed.`,
    );
    notes.push(
      "Use status or sync --dry-run to preview board changes, then sync against a protocol-3 server. Keep old scripts only until the generic Cardstock round trip is verified; reproducing project-specific validation rules is not a cutover requirement.",
    );
    if (!values.remote)
      notes.push(
        "No remote configured. Offline validation works; provide --remote when preparing remote access.",
      );
  } else {
    config = parseConfig({
      version: 1,
      project: values.project,
      board: values.board,
      tracker: values.dir ?? "tracker",
      ...(values.remote ? { remote: values.remote } : {}),
    });
  }
  if (!values["dry-run"])
    await writeFile(destination, `${JSON.stringify(config, null, 2)}\n`, {
      flag: "wx",
    });
  if (values.json)
    console.log(
      JSON.stringify(
        { ok: true, dryRun: !!values["dry-run"], destination, config, notes },
        null,
        2,
      ),
    );
  else {
    console.log(
      `${values["dry-run"] ? "Would create" : "Created"} ${destination}.`,
    );
    if (values["dry-run"]) console.log(JSON.stringify(config, null, 2));
    for (const note of notes) console.log(`Note: ${note}`);
    if (!values["dry-run"])
      console.log(
        `Run cardstock validate --config "${destination}" to check your tracker.`,
      );
  }
  return 0;
}
