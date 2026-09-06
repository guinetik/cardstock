import { randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";

export async function readOptional(file: string): Promise<string | null> {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(`Refusing non-regular file: ${file}`);
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function durableWrite(file: string, text: string) {
  const handle = await open(file, "wx", 0o600);
  try {
    await handle.writeFile(text);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function acquireSyncLock(file: string, recover = false) {
  await mkdir(path.dirname(file), { recursive: true });
  if (recover) {
    const old = await readOptional(file);
    if (old !== null) {
      const owner = JSON.parse(old) as { pid: number; hostname: string };
      if (
        owner.hostname !== hostname() ||
        !Number.isInteger(owner.pid) ||
        owner.pid <= 0
      )
        throw new Error(`Cannot establish lock owner; inspect ${file}`);
      let dead = false;
      try {
        process.kill(owner.pid, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") dead = true;
        else throw error;
      }
      if (!dead) throw new Error(`Sync process ${owner.pid} is still running`);
      if ((await readOptional(file)) !== old)
        throw new Error("Lock changed during recovery");
      await unlink(file);
    }
  }
  const handle = await open(file, "wx", 0o600);
  try {
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, hostname: hostname() }),
    );
    await handle.sync();
  } catch (error) {
    await handle.close();
    await unlink(file);
    throw error;
  }
  return async () => {
    await handle.close();
    await unlink(file);
  };
}

export async function replaceState(
  file: string,
  before: string | null,
  after: string,
) {
  const temp = `${file}.${randomUUID()}.tmp`;
  await durableWrite(temp, after);
  try {
    if ((await readOptional(file)) !== before)
      throw new Error("Baseline changed while syncing");
    await rename(temp, file);
  } catch (error) {
    await unlink(temp);
    throw error;
  }
}

/** No-clobber publication; displaced originals stay recoverable, even via an editor's open descriptor. */
export async function publishLocal(
  file: string,
  before: string | null,
  after: string,
  operation: string,
) {
  const backup = `${file}.cardstock-${operation}.before`;
  const temp = `${file}.cardstock-${operation}.tmp`;
  const current = await readOptional(file);
  const saved = await readOptional(backup);
  if (current === after) {
    if (saved !== null && saved !== before)
      throw new Error(
        `An editor changed the displaced original; inspect ${backup}`,
      );
    return;
  }
  if (
    current !== before &&
    !(current === null && saved === before && before !== null)
  )
    throw new Error(`Local file changed; preserve it and inspect ${file}`);
  const staged = await readOptional(temp);
  if (staged !== null && staged !== after)
    throw new Error(`Unexpected staging content: ${temp}`);
  if (staged === null) await durableWrite(temp, after);
  if (before !== null && current !== null) {
    if (saved !== null)
      throw new Error(
        `An original is already preserved at ${backup}; inspect before retrying`,
      );
    // rename cannot overwrite an existing backup created by this executor: the scope lock serializes runs.
    await rename(file, backup);
    if ((await readOptional(backup)) !== before) {
      try {
        await link(backup, file);
      } catch {
        /* A new local file wins; displaced bytes remain in backup. */
      }
      throw new Error(`Local edit raced sync; original preserved at ${backup}`);
    }
  }
  try {
    await link(temp, file);
  } catch (error) {
    if (before !== null) {
      try {
        await link(backup, file);
      } catch {
        /* Never overwrite a file that appeared. */
      }
    }
    throw new Error(
      `Could not publish ${file}; recovery files retained: ${String(error)}`,
    );
  }
  await unlink(temp);
  if (
    (await readOptional(file)) !== after ||
    (before !== null && (await readOptional(backup)) !== before)
  )
    throw new Error(
      `Concurrent local edit detected; inspect ${file} and ${backup}`,
    );
}
