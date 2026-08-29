import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBoardState } from "./board-state";

/** A minimal chainable stand-in for the query builder `loadBoardState` calls
 * `.select().eq().order()` (or `.select().eq()`) on, then awaits directly. */
function fakeDb(responses: Record<string, { data: unknown; error: unknown }>) {
  return {
    from(table: string) {
      const response = responses[table] ?? { data: [], error: null };
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        order() {
          return builder;
        },
        // biome-ignore lint/suspicious/noThenProperty: mimics supabase-js's thenable PostgrestBuilder, which loadBoardState awaits directly.
        then(
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown,
        ) {
          return Promise.resolve(response).then(resolve, reject);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe("loadBoardState", () => {
  test("throws, naming the query, instead of swallowing a query error", async () => {
    const db = fakeDb({
      lanes: { data: null, error: { message: "boom" } },
    });
    await expect(loadBoardState(db, "board-1")).rejects.toThrow(/lanes.*boom/);
  });
});
