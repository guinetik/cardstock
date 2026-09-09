import { expect, test } from "bun:test";
import { createActivityStore } from "./activity";

test("overlapping writes and navigation finish independently", () => {
  const store = createActivityStore();
  const loading = store.begin("loading");
  const first = store.begin("saving", "card-a");
  const second = store.begin("saving", "card-a");
  expect(store.snapshot()).toBe("saving");
  first();
  first(); // Cleanup is idempotent, including Strict Mode and unmount cleanup.
  expect(store.saving("card-a")).toBe(true);
  expect(store.saving("card-b")).toBe(false);
  second();
  expect(store.saving("card-a")).toBe(false);
  expect(store.snapshot()).toBe("loading");
  loading();
  expect(store.snapshot()).toBeNull();
});

test("failed work clears activity while preserving the caller's error", async () => {
  const store = createActivityStore();
  const failure = new Error("Offline");
  await expect(
    store.run(
      "saving",
      async () => {
        throw failure;
      },
      "a",
    ),
  ).rejects.toBe(failure);
  expect(store.snapshot()).toBeNull();
  const result = await store.run("saving", async () => ({
    ok: false,
    error: "Invalid name",
  }));
  expect(result).toEqual({ ok: false, error: "Invalid name" });
  expect(store.snapshot()).toBeNull();
});

test("pending operations remain visible until their own promise settles", async () => {
  const store = createActivityStore();
  let finish!: (value: number) => void;
  const slow = store.run(
    "saving",
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    "a",
  );
  await store.run("saving", async () => 2, "b");
  expect(store.saving("a")).toBe(true);
  expect(store.saving("b")).toBe(false);
  finish(42);
  expect(await slow).toBe(42);
  expect(store.snapshot()).toBeNull();
});
