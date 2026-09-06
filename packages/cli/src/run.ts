import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { parseConfig, validateTracker } from "@cardstock/core";
import { version } from "../package.json";

const HELP = `Usage: cardstock <command>

  init --project <slug> --board <slug> [--dir tracker] [--remote <url>]
  validate [--config <file>] [--json]
  --version, -v
  --help, -h

init writes cardstock.json without replacing an existing file.
validate discovers cardstock.json in this directory or its parents and checks <id>.md files.
Validation is offline; authentication and remote sync are not available yet.`;

async function findConfig(cwd: string): Promise<string> {
  let directory = path.resolve(cwd);
  while (true) {
    const candidate = path.join(directory, "cardstock.json");
    try {
      await readFile(candidate, "utf8");
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory)
      throw new Error(
        "No cardstock.json found. Run cardstock init --project <slug> --board <slug>.",
      );
    directory = parent;
  }
}

export async function run(args: string[], cwd: string): Promise<number> {
  const json = args[0] === "validate" && args.includes("--json");
  try {
    if (args.length === 1 && ["--version", "-v"].includes(args[0])) {
      console.log(version);
      return 0;
    }
    if (
      args.length === 0 ||
      (args.length === 1 && ["--help", "-h"].includes(args[0]))
    ) {
      console.log(HELP);
      return 0;
    }
    const command = args[0];
    if (command === "init") {
      const { values } = parseArgs({
        args: args.slice(1),
        options: {
          project: { type: "string" },
          board: { type: "string" },
          dir: { type: "string", default: "tracker" },
          remote: { type: "string" },
        },
      });
      const config = parseConfig({
        version: 1,
        project: values.project,
        board: values.board,
        tracker: values.dir,
        ...(values.remote ? { remote: values.remote } : {}),
      });
      const destination = path.join(cwd, "cardstock.json");
      await writeFile(destination, `${JSON.stringify(config, null, 2)}\n`, {
        flag: "wx",
      });
      console.log(
        `Created ${destination}. Run cardstock validate to check your tracker.`,
      );
      return 0;
    }
    if (command === "validate") {
      const { values } = parseArgs({
        args: args.slice(1),
        options: { config: { type: "string" }, json: { type: "boolean" } },
      });
      const configPath = values.config
        ? path.resolve(cwd, values.config)
        : await findConfig(cwd);
      const config = parseConfig(
        JSON.parse(await readFile(configPath, "utf8")),
      );
      const tracker = path.resolve(path.dirname(configPath), config.tracker);
      const entries = await readdir(tracker, { withFileTypes: true });
      const names = entries
        .filter((entry) => entry.isFile() && /^\d+\.md$/.test(entry.name))
        .map((entry) => entry.name)
        .sort();
      if (!names.length)
        throw new Error(`No <id>.md files found in ${tracker}`);
      const files = await Promise.all(
        names.map(async (name) => ({
          name,
          text: await readFile(path.join(tracker, name), "utf8"),
        })),
      );
      const report = validateTracker(files);
      if (values.json) console.log(JSON.stringify(report, null, 2));
      else {
        for (const diagnostic of report.diagnostics)
          console.error(`${diagnostic.file}: ${diagnostic.message}`);
        console.log(
          `${report.files} files checked; ${report.diagnostics.length} errors.`,
        );
      }
      return report.ok ? 0 : 1;
    }
    throw new Error(`Unknown command: ${command}. Run cardstock --help.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) console.log(JSON.stringify({ ok: false, error: message }));
    else console.error(message);
    return 2;
  }
}
