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
        maybeSingle() {
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
  test("the stored sheet becomes a flag; the joins are shaped, not carried", async () => {
    const db = fakeDb({
      cards: {
        data: [
          {
            id: "c1",
            external_id: "1",
            source_text: "a stored sheet",
            frontmatter_extra: null,
            card_tags: [{ tag_id: "t1" }],
            card_links: [{ to_card: "c2", kind: "relates" }],
          },
          { id: "c2", external_id: "2", source_text: null, card_tags: null },
        ],
        error: null,
      },
    });
    const state = await loadBoardState(db, "board-1");
    const one = state.cards.get("1")!;
    expect(one.has_source_text).toBe(true);
    expect(one.tag_ids).toEqual(["t1"]);
    expect(one.relates).toEqual([2]);
    expect("source_text" in one).toBe(false);
    expect("card_tags" in one).toBe(false);
    expect("card_links" in one).toBe(false);
    expect(state.cards.get("2")!.has_source_text).toBe(false);
  });
  test("a project member survives the roster load", async () => {
    const db = fakeDb({
      boards: { data: { project_id: "proj-1" }, error: null },
      project_members: {
        data: [
          { members: { id: "m1", email: "ana@x.test", display_name: "Ana" } },
        ],
        error: null,
      },
    });
    const state = await loadBoardState(db, "board-1");
    expect(state.members).toEqual([
      { memberId: "m1", email: "ana@x.test", displayName: "Ana" },
    ]);
  });
});
