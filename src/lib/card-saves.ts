/** Per-sheet saves shared by the editors and download control. No persisted state. */
export function createCardSaves() {
  const pending = new Set<Promise<unknown>>();
  const errors = new Map<string, string>();
  const drafts = new Map<string, string>();
  return {
    clear(key: string) {
      errors.delete(key);
    },
    draft(key: string, message: string | null) {
      if (message) drafts.set(key, message);
      else drafts.delete(key);
    },
    async run<T extends { ok: boolean }>(
      key: string,
      work: () => Promise<T>,
    ): Promise<T> {
      const promise = Promise.resolve().then(work);
      pending.add(promise);
      try {
        const result = await promise;
        if (result.ok) errors.delete(key);
        else
          errors.set(
            key,
            "An edit could not be saved. Fix it before downloading.",
          );
        return result;
      } catch (error) {
        errors.set(
          key,
          "An edit could not be saved. Try saving it again before downloading.",
        );
        throw error;
      } finally {
        pending.delete(promise);
      }
    },
    async ready(): Promise<string | null> {
      while (pending.size) await Promise.allSettled([...pending]);
      return (
        errors.values().next().value ?? drafts.values().next().value ?? null
      );
    },
  };
}
