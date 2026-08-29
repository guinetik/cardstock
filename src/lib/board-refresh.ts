/**
 * Realtime is a doorbell, not a data feed: every change on the board just asks
 * for a fresh snapshot. This coalesces those asks and keeps them from stepping
 * on a local optimistic edit that has not committed yet.
 *
 * - `nudge()`   — something changed; refresh after a short debounce.
 * - `settled()` — the local pending action finished; run a deferred refresh.
 * - `dispose()` — stop everything; late results are dropped.
 */
export interface BoardRefreshOptions<T> {
  debounceMs: number;
  fetch: () => Promise<T>;
  apply: (data: T) => void;
  /** True while a local optimistic action is still in flight. */
  isBusy: () => boolean;
  onError?: (e: unknown) => void;
  /** Injectable timer for tests. Returns a cancel function. */
  schedule?: (fn: () => void, ms: number) => () => void;
}

export interface BoardRefresh {
  nudge: () => void;
  settled: () => void;
  dispose: () => void;
}

const defaultSchedule = (fn: () => void, ms: number) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export function createBoardRefresh<T>(
  opts: BoardRefreshOptions<T>,
): BoardRefresh {
  const schedule = opts.schedule ?? defaultSchedule;
  let cancel: (() => void) | null = null;
  let inFlight = false;
  let dirty = false; // nudged while a fetch was running
  let deferred = false; // wanted to run but a local action was pending
  let disposed = false;

  function run() {
    if (disposed) return;
    if (opts.isBusy()) {
      deferred = true;
      return;
    }
    if (inFlight) {
      dirty = true;
      return;
    }
    inFlight = true;
    opts
      .fetch()
      .then(
        (data) => {
          if (!disposed) opts.apply(data);
        },
        (e) => {
          if (!disposed) opts.onError?.(e);
        },
      )
      .then(() => {
        inFlight = false;
        if (disposed || !dirty) return;
        dirty = false;
        run();
      });
  }

  return {
    nudge() {
      if (disposed) return;
      cancel?.();
      cancel = schedule(() => {
        cancel = null;
        run();
      }, opts.debounceMs);
    },
    settled() {
      if (!deferred) return;
      deferred = false;
      run();
    },
    dispose() {
      disposed = true;
      cancel?.();
      cancel = null;
    },
  };
}
