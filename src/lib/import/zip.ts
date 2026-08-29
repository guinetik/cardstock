import { unzipSync } from "fflate";
import type { SheetFile } from "./types";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const SHEET = /(^|\/)(\d+)\.md$/;

/** The sheets in an upload: every `<n>.md` at any depth, sorted by id. Everything else is ignored. */
export function filesFromZip(bytes: Uint8Array): SheetFile[] {
  if (bytes.byteLength > MAX_UPLOAD_BYTES)
    throw new Error(
      "The upload is over 4 MB — use the command line for a tracker that size.",
    );
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error("That file is not a zip.");
  }
  const dec = new TextDecoder("utf-8");
  const files: SheetFile[] = [];
  for (const [path, data] of Object.entries(entries)) {
    const m = SHEET.exec(path);
    if (!m || path.endsWith("/")) continue;
    files.push({ name: `${m[2]}.md`, text: dec.decode(data) });
  }
  if (!files.length) throw new Error("That zip has no <n>.md files.");
  return files.sort(
    (a, b) => Number.parseInt(a.name, 10) - Number.parseInt(b.name, 10),
  );
}
