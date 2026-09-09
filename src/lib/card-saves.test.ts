import { expect, test } from "bun:test";
import { createCardSaves } from "./card-saves";

test("download waits for every in-flight save, including a save started while waiting", async () => {
  const saves = createCardSaves();
  let finish!: (result: { ok: boolean }) => void;
  const first = saves.run(
    "title",
    () =>
      new Promise<{ ok: boolean }>((resolve) => {
        finish = resolve;
      }),
  );
  let ready = false;
  const waiting = saves.ready().then((error) => {
    ready = true;
    return error;
  });
  await Promise.resolve();
  expect(ready).toBe(false);
  const second = saves.run("summary", async () => ({ ok: false }));
  finish({ ok: true });
  await Promise.all([first, second]);
  expect(await waiting).toContain("could not be saved");
  await saves.run("summary", async () => ({ ok: true }));
  expect(await saves.ready()).toBeNull();
});

test("a failed edit cannot be hidden by an unrelated successful save", async () => {
  const saves = createCardSaves();
  await saves.run("title", async () => ({ ok: false }));
  await saves.run("tags", async () => ({ ok: true }));
  expect(await saves.ready()).not.toBeNull();
  saves.clear("title");
  expect(await saves.ready()).toBeNull();
});

test("network failures and unsaved drafts block stale downloads until resolved", async () => {
  const saves = createCardSaves();
  await expect(
    saves.run("body", () => {
      throw new Error("offline");
    }),
  ).rejects.toThrow("offline");
  expect(await saves.ready()).toContain("Try saving");
  saves.clear("body");
  saves.draft("body", "Save your draft first.");
  expect(await saves.ready()).toBe("Save your draft first.");
  saves.draft("body", null);
  expect(await saves.ready()).toBeNull();
});
