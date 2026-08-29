import { describe, expect, test } from "bun:test";
import { zipSync } from "fflate";
import { filesFromZip, MAX_UPLOAD_BYTES } from "./zip";

const enc = (s: string) => new TextEncoder().encode(s);

describe("filesFromZip", () => {
  test("keeps <n>.md at any depth, ignores the rest, sorts by id", () => {
    const zip = zipSync({
      "tracker/10.md": enc("---\nid: 10\n---\n"),
      "tracker/2.md": enc("---\nid: 2\n---\n"),
      "tracker/README.md": enc("# no"),
      "notes.txt": enc("no"),
      "tracker/nested/3.md": enc("---\nid: 3\n---\n"),
    });
    expect(filesFromZip(zip).map((f) => f.name)).toEqual([
      "2.md",
      "3.md",
      "10.md",
    ]);
    expect(filesFromZip(zip)[0].text).toBe("---\nid: 2\n---\n");
  });
  test("rejects a zip with no sheets", () => {
    expect(() => filesFromZip(zipSync({ "a.txt": enc("x") }))).toThrow(
      /no <n>\.md/,
    );
  });
  test("rejects an oversized upload before unzipping", () => {
    expect(() => filesFromZip(new Uint8Array(MAX_UPLOAD_BYTES + 1))).toThrow(
      /over 4 MB/,
    );
  });
});
