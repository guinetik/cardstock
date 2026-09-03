import { describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApplyError, applyPlan } from "./apply";
import type { BoardState, ExistingCard, Plan, PlanRow } from "./types";

/**
 * A chainable stand-in for the query builder. `failAt` is the nth `.single()`
 * — the nth card write — that comes back with an error; `events` counts the
 * `card_events` rows the applier tried to insert.
 */
function fakeDb(failAt = 0) {
  const events: unknown[] = [];
  const cardWrites: Record<string, unknown>[] = [];
  let writes = 0;
  const db = {
    from(table: string) {
      // biome-ignore lint/suspicious/noExplicitAny: a stand-in, not the real builder
      const builder: any = {
        upsert: (columns: Record<string, unknown>) => {
          if (table === "cards") cardWrites.push(columns);
          return builder;
        },
        update: (columns: Record<string, unknown>) => {
          if (table === "cards") cardWrites.push(columns);
          return builder;
        },
        delete: () => builder,
        eq: () => builder,
        select: () => builder,
        insert: (rows: unknown) => {
          if (table === "card_events") events.push(rows);
          return builder;
        },
        single: () => {
          writes++;
          return Promise.resolve(
            writes === failAt
              ? { data: null, error: { message: "boom" } }
              : { data: { id: `db-${writes}` }, error: null },
          );
        },
        // biome-ignore lint/suspicious/noThenProperty: mimics supabase-js's thenable builder
        then: (
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown,
        ) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
      };
      return builder;
    },
  };
  return { db: db as unknown as SupabaseClient, events, cardWrites };
}

const card = (external_id: string): ExistingCard =>
  ({
    id: `c-${external_id}`,
    external_id,
    tag_ids: [],
    relates: [],
  }) as unknown as ExistingCard;

const state = (
  cards: ExistingCard[] = [],
  members: BoardState["members"] = [],
): BoardState => ({
  id: "board-1",
  lanes: [],
  groups: [],
  cards: new Map(cards.map((c) => [c.external_id, c])),
  epics: new Map(),
  members,
});

const patch = () => ({
  columns: { external_id: "x" },
  laneKey: null,
  rank: undefined,
  tagRefs: undefined,
  relates: undefined,
  epic: undefined,
});

const plan = (rows: PlanRow[]): Plan => ({
  ok: true,
  rows,
  newLanes: [],
  newGroups: [],
  newTags: [],
  unappliedTags: [],
  ambiguousTags: [],
  counts: { new: 0, changed: 0, unchanged: 0, error: 0 },
});

describe("applyPlan", () => {
  test("a write that fails partway throws what it had already filed", async () => {
    const { db } = fakeDb(2);
    const rows: PlanRow[] = [1, 2, 3].map((n) => ({
      id: String(n),
      title: `Card ${n}`,
      verdict: "new",
      lane: "unsorted",
      changes: [],
      patch: patch(),
      hash: "h",
    }));
    const e = await applyPlan(db, state(), plan(rows), "me").catch((x) => x);
    expect(e).toBeInstanceOf(ApplyError);
    expect(e as ApplyError).toMatchObject({ created: 1, updated: 0 });
    expect((e as Error).message).toBe("#2: boom");
  });

  test("a recalibrate row records the sheet without an event or a changed count", async () => {
    const { db, events } = fakeDb();
    const rows: PlanRow[] = [
      {
        id: "1",
        title: "Card 1",
        verdict: "changed",
        changes: [],
        patch: patch(),
        hash: "h",
      },
      {
        id: "2",
        title: "Card 2",
        verdict: "changed",
        changes: [{ key: "title", from: "a", to: "b" }],
        patch: patch(),
        hash: "h",
      },
    ];
    const counts = await applyPlan(
      db,
      state([card("1"), card("2")]),
      plan(rows),
      "me",
    );
    expect(counts).toEqual({ created: 0, updated: 1, recalibrated: 1 });
    expect(events).toHaveLength(1);
  });

  test("an assignee email matching a member resolves to their id", async () => {
    const { db, cardWrites } = fakeDb();
    const rows: PlanRow[] = [
      {
        id: "1",
        title: "Card 1",
        verdict: "new",
        lane: "unsorted",
        changes: [],
        patch: {
          ...patch(),
          columns: { external_id: "1", assignee: "Ana@Example.com" },
        },
        hash: "h",
      },
    ];
    await applyPlan(
      db,
      state(
        [],
        [{ memberId: "m-1", email: "ana@example.com", displayName: "Ana" }],
      ),
      plan(rows),
      "me",
    );
    expect(cardWrites).toHaveLength(1);
    expect(cardWrites[0]).toMatchObject({
      assignee: "Ana@Example.com",
      assignee_id: "m-1",
    });
  });

  test("an assignee email matching nobody leaves the FK null and keeps the text", async () => {
    const { db, cardWrites } = fakeDb();
    const rows: PlanRow[] = [
      {
        id: "1",
        title: "Card 1",
        verdict: "new",
        lane: "unsorted",
        changes: [],
        patch: {
          ...patch(),
          columns: { external_id: "1", assignee: "nobody@example.com" },
        },
        hash: "h",
      },
    ];
    await applyPlan(db, state([], []), plan(rows), "me");
    expect(cardWrites).toHaveLength(1);
    expect(cardWrites[0]).toMatchObject({
      assignee: "nobody@example.com",
      assignee_id: null,
    });
  });
});
