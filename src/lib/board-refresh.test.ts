import { describe, expect, test } from "bun:test";
import { createBoardRefresh } from "./board-refresh";

/** A hand-cranked timer so tests control when the debounce fires. */
function manualTimers() {
  const pending: { fn: () => void; ms: number }[] = [];
  return {
    schedule(fn: () => void, ms: number) {
      const entry = { fn, ms };
      pending.push(entry);
      return () => {
        const i = pending.indexOf(entry);
        if (i >= 0) pending.splice(i, 1);
      };
    },
    fire() {
      const batch = pending.splice(0);
      for (const p of batch) p.fn();
    },
    get count() {
      return pending.length;
    },
  };
}

/** A fetch whose resolution the test controls. */
function controlledFetch<T>() {
  let calls = 0;
  const resolvers: ((v: T) => void)[] = [];
  const rejecters: ((e: unknown) => void)[] = [];
  return {
    fetch: () =>
      new Promise<T>((res, rej) => {
        calls++;
        resolvers.push(res);
        rejecters.push(rej);
      }),
    resolve(v: T) {
      resolvers.shift()!(v);
      rejecters.shift();
    },
    reject(e: unknown) {
      resolvers.shift();
      rejecters.shift()!(e);
    },
    get calls() {
      return calls;
    },
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("createBoardRefresh", () => {
  test("many nudges inside the debounce window fetch once", async () => {
    const timers = manualTimers();
    const f = controlledFetch<string>();
    const applied: string[] = [];
    const r = createBoardRefresh({
      debounceMs: 250,
      schedule: timers.schedule,
      fetch: f.fetch,
      apply: (d) => applied.push(d),
      isBusy: () => false,
    });
    r.nudge();
    r.nudge();
    r.nudge();
    expect(timers.count).toBe(1);
    expect(f.calls).toBe(0);
    timers.fire();
    expect(f.calls).toBe(1);
    f.resolve("snapshot");
    await tick();
    expect(applied).toEqual(["snapshot"]);
  });

  test("defers while a local action is pending and runs on settled()", async () => {
    const timers = manualTimers();
    const f = controlledFetch<string>();
    const applied: string[] = [];
    let busy = true;
    const r = createBoardRefresh({
      debounceMs: 250,
      schedule: timers.schedule,
      fetch: f.fetch,
      apply: (d) => applied.push(d),
      isBusy: () => busy,
    });
    r.nudge();
    timers.fire();
    expect(f.calls).toBe(0);
    busy = false;
    r.settled();
    expect(f.calls).toBe(1);
    f.resolve("after");
    await tick();
    expect(applied).toEqual(["after"]);
  });

  test("settled() without a deferred refresh does nothing", () => {
    const timers = manualTimers();
    const f = controlledFetch<string>();
    const r = createBoardRefresh({
      debounceMs: 250,
      schedule: timers.schedule,
      fetch: f.fetch,
      apply: () => {},
      isBusy: () => false,
    });
    r.settled();
    expect(f.calls).toBe(0);
  });

  test("a nudge during an in-flight fetch runs one more fetch after it", async () => {
    const timers = manualTimers();
    const f = controlledFetch<string>();
    const applied: string[] = [];
    const r = createBoardRefresh({
      debounceMs: 250,
      schedule: timers.schedule,
      fetch: f.fetch,
      apply: (d) => applied.push(d),
      isBusy: () => false,
    });
    r.nudge();
    timers.fire();
    expect(f.calls).toBe(1);
    r.nudge();
    r.nudge();
    timers.fire();
    // still only one in flight
    expect(f.calls).toBe(1);
    f.resolve("first");
    await tick();
    expect(f.calls).toBe(2);
    f.resolve("second");
    await tick();
    expect(applied).toEqual(["first", "second"]);
  });

  test("a failed fetch is reported and does not block the next one", async () => {
    const timers = manualTimers();
    const f = controlledFetch<string>();
    const applied: string[] = [];
    const errors: unknown[] = [];
    const r = createBoardRefresh({
      debounceMs: 250,
      schedule: timers.schedule,
      fetch: f.fetch,
      apply: (d) => applied.push(d),
      isBusy: () => false,
      onError: (e) => errors.push(e),
    });
    r.nudge();
    timers.fire();
    f.reject(new Error("boom"));
    await tick();
    expect(errors).toHaveLength(1);
    r.nudge();
    timers.fire();
    expect(f.calls).toBe(2);
    f.resolve("ok");
    await tick();
    expect(applied).toEqual(["ok"]);
  });

  test("dispose() cancels the pending debounce and drops late results", async () => {
    const timers = manualTimers();
    const f = controlledFetch<string>();
    const applied: string[] = [];
    const r = createBoardRefresh({
      debounceMs: 250,
      schedule: timers.schedule,
      fetch: f.fetch,
      apply: (d) => applied.push(d),
      isBusy: () => false,
    });
    r.nudge();
    timers.fire();
    expect(f.calls).toBe(1);
    r.nudge();
    expect(timers.count).toBe(1);
    r.dispose();
    expect(timers.count).toBe(0);
    f.resolve("late");
    await tick();
    expect(applied).toEqual([]);
  });
});
