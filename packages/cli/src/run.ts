import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { parseConfig, validateTracker } from "@cardstock/core";
import { version } from "../package.json";
import { findConfig } from "./config";
import { credentialFor, removeCredential, saveCredential } from "./credentials";
import { DELETE_HELP, deleteCards } from "./delete";
import { INIT_HELP, init } from "./init";
import { NEW_HELP, newCard } from "./new";
import { PREVIEW_HELP, preview } from "./preview";
import { executeSync } from "./sync-execute";

const HELP = `Usage: cardstock <command>

  init --project <slug> --board <slug> [--dir tracker] [--remote <url>]
  init --from <board.json> [--out <file>] [--remote <url>] [--dry-run] [--json]
  new <title> [--summary <text>] [--epic <name>] [--area <name>] [--tags <t,t>]
              [--status <status>] [--lane <lane>] [--remote <url>] [--json]
  validate [--config <file>] [--json]
  status [--card <id>] [--config <file>] [--remote <url>] [--json]
  sync [--card <id>] [--dry-run] [--config <file>] [--remote <url>] [--json]
                 [--ours <id>[:<field>]] [--theirs <id>[:<field>]]
  baseline [--config <file>] [--remote <url>] [--json]
  delete <id> [<id> ...] | --file <path> [--dry-run] [--json]
  sync --resume | --abort [--recover-lock] [--remote <url>] [--json]
  login --remote <url> [--no-browser]
  logout --remote <url>
  --version, -v
  --help, -h

init writes cardstock.json without replacing an existing file.
new asks the board for the next unused card ID and writes <id>.md in the tracker.
validate discovers cardstock.json in this directory or its parents and checks <id>.md files.
login opens Cardstock in a browser and stores its credential outside the repository.`;

const LOGIN_HELP = `Usage: cardstock login [--remote <url>] [--no-browser]

Sign in through Cardstock in your browser and save a personal access token.
Pass --remote, or set remote in cardstock.json with cardstock init.
--no-browser prints the approval URL instead of opening it.`;

const LOGOUT_HELP = `Usage: cardstock logout [--remote <url>]

Revoke the saved personal access token and remove it from this computer.
Pass --remote, or set remote in cardstock.json with cardstock init.`;

async function remoteFor(cwd: string, explicit?: string): Promise<string> {
  if (explicit) return explicit.replace(/\/$/, "");
  const config = parseConfig(
    JSON.parse(await readFile(await findConfig(cwd), "utf8")),
  );
  if (!config.remote)
    throw new Error(
      "No remote configured. Pass --remote <url> or run init with --remote.",
    );
  return config.remote.replace(/\/$/, "");
}

function openBrowser(url: string) {
  const command =
    process.platform === "win32"
      ? "cmd"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function run(args: string[], cwd: string): Promise<number> {
  const json =
    [
      "validate",
      "init",
      "new",
      "status",
      "sync",
      "baseline",
      "delete",
    ].includes(args[0]) && args.includes("--json");
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
    if (args.length === 2 && ["--help", "-h"].includes(args[1])) {
      if (command === "delete") {
        console.log(DELETE_HELP);
        return 0;
      }
      if (["status", "sync", "baseline"].includes(command)) {
        console.log(PREVIEW_HELP);
        return 0;
      }
      if (command === "init") {
        console.log(INIT_HELP);
        return 0;
      }
      if (command === "new") {
        console.log(NEW_HELP);
        return 0;
      }
      if (command === "login") {
        console.log(LOGIN_HELP);
        return 0;
      }
      if (command === "logout") {
        console.log(LOGOUT_HELP);
        return 0;
      }
    }
    if (command === "init") {
      return await init(args.slice(1), cwd);
    }
    if (command === "new") return await newCard(args.slice(1), cwd);
    if (command === "delete") return await deleteCards(args.slice(1), cwd);
    if (command === "sync" && !args.slice(1).some((arg) => arg === "--dry-run"))
      return await executeSync(args.slice(1), cwd);
    if (["status", "sync", "baseline"].includes(command))
      return await preview(command, args.slice(1), cwd);
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
      const report = validateTracker(files, config.scheme);
      if (values.json) console.log(JSON.stringify(report, null, 2));
      else {
        for (const diagnostic of report.diagnostics)
          console.error(
            `${diagnostic.file}: ${diagnostic.message}${diagnostic.reference ? ` (see ${path.resolve(path.dirname(configPath), diagnostic.reference)})` : ""}`,
          );
        console.log(
          `${report.files} files checked; ${report.diagnostics.length} errors.`,
        );
      }
      return report.ok ? 0 : 1;
    }
    if (command === "login") {
      const { values } = parseArgs({
        args: args.slice(1),
        options: {
          remote: { type: "string" },
          "no-browser": { type: "boolean" },
        },
      });
      const remote = await remoteFor(cwd, values.remote);
      const start = await fetch(`${remote}/api/v1/cli/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceName: `Cardstock CLI on ${process.platform}`,
        }),
      });
      if (!start.ok) throw new Error("Could not start Cardstock sign-in.");
      const request = (await start.json()) as {
        deviceCode: string;
        verificationUriComplete: string;
        expiresIn: number;
        interval: number;
      };
      console.log(
        `Open ${request.verificationUriComplete} and approve Cardstock CLI.`,
      );
      if (!values["no-browser"]) openBrowser(request.verificationUriComplete);
      const deadline = Date.now() + request.expiresIn * 1000;
      while (Date.now() < deadline) {
        await wait(request.interval * 1000);
        const response = await fetch(`${remote}/api/v1/cli/login/poll`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ deviceCode: request.deviceCode }),
        });
        if (response.status === 204) continue;
        if (!response.ok)
          throw new Error("Cardstock sign-in could not be completed.");
        const credential = (await response.json()) as {
          token: string;
          email: string;
        };
        await saveCredential({
          remote,
          token: credential.token,
          email: credential.email,
          createdAt: new Date().toISOString(),
        });
        console.log(`Signed in to ${remote} as ${credential.email}.`);
        return 0;
      }
      throw new Error("Cardstock sign-in expired. Run cardstock login again.");
    }
    if (command === "logout") {
      const { values } = parseArgs({
        args: args.slice(1),
        options: { remote: { type: "string" } },
      });
      const remote = await remoteFor(cwd, values.remote);
      const credential = await credentialFor(remote);
      if (!credential) {
        console.log(`Not signed in to ${remote}.`);
        return 0;
      }
      const response = await fetch(`${remote}/api/v1/cli/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${credential.token}` },
      });
      if (!response.ok)
        throw new Error(
          "Cardstock could not revoke this credential. It remains stored locally.",
        );
      await removeCredential(remote);
      console.log(`Signed out of ${remote}.`);
      return 0;
    }
    throw new Error(`Unknown command: ${command}. Run cardstock --help.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) console.log(JSON.stringify({ ok: false, error: message }));
    else console.error(message);
    return 2;
  }
}
