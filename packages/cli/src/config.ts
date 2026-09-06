import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseConfig } from "@cardstock/core";

export async function findConfig(cwd: string): Promise<string> {
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

export async function loadConfig(cwd: string, explicit?: string) {
  const file = explicit ? path.resolve(cwd, explicit) : await findConfig(cwd);
  return {
    file,
    config: parseConfig(JSON.parse(await readFile(file, "utf8"))),
  };
}
