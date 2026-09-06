import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export interface Credential {
  remote: string;
  token: string;
  email: string;
  createdAt: string;
}

function credentialsPath(): string {
  const root =
    process.platform === "win32"
      ? (process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"))
      : (process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config"));
  return path.join(root, "cardstock", "credentials.json");
}

async function readCredentials(): Promise<Credential[]> {
  try {
    return JSON.parse(
      await readFile(credentialsPath(), "utf8"),
    ) as Credential[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error("Could not read Cardstock CLI credentials.");
  }
}

export async function saveCredential(next: Credential): Promise<void> {
  const file = credentialsPath();
  const all = (await readCredentials()).filter(
    (item) => item.remote !== next.remote,
  );
  all.push(next);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 });
}

export async function credentialFor(
  remote: string,
): Promise<Credential | null> {
  return (
    (await readCredentials()).find((item) => item.remote === remote) ?? null
  );
}

export async function removeCredential(
  remote: string,
): Promise<Credential | null> {
  const file = credentialsPath();
  const all = await readCredentials();
  const found = all.find((item) => item.remote === remote) ?? null;
  const keep = all.filter((item) => item.remote !== remote);
  if (!keep.length) {
    await rm(file, { force: true });
    return found;
  }
  await writeFile(file, `${JSON.stringify(keep, null, 2)}\n`, { mode: 0o600 });
  return found;
}
