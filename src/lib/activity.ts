export type ActivityKind = "saving" | "loading";
type Activity = { kind: ActivityKind; subject?: string };

/** Each operation owns a token: completing one cannot hide another's work. */
export function createActivityStore() {
  const operations = new Map<symbol, Activity>();
  const listeners = new Set<() => void>();
  const publish = () => {
    for (const listener of listeners) listener();
  };
  const begin = (kind: ActivityKind, subject?: string) => {
    const token = Symbol(kind);
    operations.set(token, { kind, subject });
    publish();
    return () => {
      if (operations.delete(token)) publish();
    };
  };
  return {
    begin,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot(): ActivityKind | null {
      let loading = false;
      for (const operation of operations.values()) {
        if (operation.kind === "saving") return "saving";
        loading = true;
      }
      return loading ? "loading" : null;
    },
    saving(subject: string) {
      return [...operations.values()].some(
        (operation) =>
          operation.kind === "saving" && operation.subject === subject,
      );
    },
    async run<T>(
      kind: ActivityKind,
      work: () => Promise<T>,
      subject?: string,
    ): Promise<T> {
      const finish = begin(kind, subject);
      try {
        return await work();
      } finally {
        finish();
      }
    },
  };
}

// Only user-initiated client work registers here; polling and prefetch stay quiet.
export const activity = createActivityStore();
export const trackActivity = activity.run;
