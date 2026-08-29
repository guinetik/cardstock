import { unzipSync } from "fflate";
import type { SheetFile } from "./types";

/**
 * The upload cap. A server action's body is limited (see `next.config.ts`) and
 * a hosted function's body harder still — 4.5 MB on Vercel, multipart overhead
 * included — so 3 MB is what a browser upload may carry. A larger tracker goes
 * through the command line.
 */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
/** A single sheet over this is not a tracker file; a zip bomb decompresses through it. */
const MAX_ENTRY_BYTES = 1 << 20;
/** More matching sheets than any tracker has — refused rather than decompressed. */
const MAX_ENTRIES = 5000;
const SHEET = /(^|\/)(\d+)\.md$/;

/** Zips written on Windows use `\` as the separator; the tracker's paths are `/`. */
const slash = (p: string) => p.replace(/\\/g, "/");

/** The sheets in an upload: every `<n>.md` at any depth, sorted by id. Everything else is ignored. */
export function filesFromZip(bytes: Uint8Array): SheetFile[] {
  if (bytes.byteLength > MAX_UPLOAD_BYTES)
    throw new Error(
      "The upload is over 3 MB — use the command line for a tracker that size.",
    );
  let entries: Record<string, Uint8Array>;
  let matched = 0;
  try {
    // Only the sheets are decompressed, and only up to a sheet's worth each,
    // and only as many as a tracker plausibly has: a zip bomb never reaches
    // memory. Counting inside the filter stops the work, not just the result.
    entries = unzipSync(bytes, {
      filter: (f) => {
        if (!SHEET.test(slash(f.name)) || f.originalSize > MAX_ENTRY_BYTES)
          return false;
        matched++;
        return matched <= MAX_ENTRIES;
      },
    });
  } catch {
    throw new Error("That file is not a zip.");
  }
  if (matched > MAX_ENTRIES) throw new Error("That zip has too many files.");
  const names = Object.keys(entries);
  const dec = new TextDecoder("utf-8");
  const files: SheetFile[] = [];
  for (const path of names) {
    const m = SHEET.exec(slash(path));
    if (!m) continue;
    files.push({ name: `${m[2]}.md`, text: dec.decode(entries[path]) });
  }
  if (!files.length) throw new Error("That zip has no <n>.md files.");
  return files.sort(
    (a, b) => Number.parseInt(a.name, 10) - Number.parseInt(b.name, 10),
  );
}
