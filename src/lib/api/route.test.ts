import { describe, expect, test } from "bun:test";
import { resolveAccess } from "./route";

function fakeDb(rows: {
  project?: { id: string; slug: string } | null;
  board?: {
    id: string;
    slug: string;
    settings: Record<string, unknown>;
  } | null;
  role?: string | null;
}) {
  return {
    from(table: string) {
      const result =
        table === "projects"
          ? (rows.project ?? null)
          : table === "boards"
            ? (rows.board ?? null)
            : rows.role == null
              ? null
              : { role: rows.role };
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: result }),
      };
      return chain;
    },
  } as never;
}

const member = { id: "m1", email: "a@b.c", role: "member" };

describe("resolveAccess", () => {
  test("a project member gets the board without manage rights", async () => {
    const got = await resolveAccess(
      fakeDb({
        project: { id: "p1", slug: "proj" },
        board: { id: "b1", slug: "board", settings: {} },
        role: "member",
      }),
      member,
      "proj",
      "board",
    );
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.canManage).toBe(false);
  });

  test("a project admin can manage", async () => {
    const got = await resolveAccess(
      fakeDb({
        project: { id: "p1", slug: "proj" },
        board: { id: "b1", slug: "board", settings: {} },
        role: "admin",
      }),
      member,
      "proj",
      "board",
    );
    expect(got.ok && got.canManage).toBe(true);
  });

  test("the site owner can manage without a membership row", async () => {
    const got = await resolveAccess(
      fakeDb({
        project: { id: "p1", slug: "proj" },
        board: { id: "b1", slug: "board", settings: {} },
        role: null,
      }),
      { ...member, role: "owner" },
      "proj",
      "board",
    );
    expect(got.ok && got.canManage).toBe(true);
  });

  test("a non-member gets not_found", async () => {
    await expect(
      resolveAccess(
        fakeDb({
          project: { id: "p1", slug: "proj" },
          board: { id: "b1", slug: "board", settings: {} },
          role: null,
        }),
        member,
        "proj",
        "board",
      ),
    ).resolves.toEqual({ ok: false, code: "not_found" });
  });

  test("unknown projects and boards are not_found", async () => {
    await expect(
      resolveAccess(fakeDb({ project: null }), member, "nope", "board"),
    ).resolves.toEqual({ ok: false, code: "not_found" });
    await expect(
      resolveAccess(
        fakeDb({
          project: { id: "p1", slug: "proj" },
          board: null,
          role: "admin",
        }),
        member,
        "proj",
        "nope",
      ),
    ).resolves.toEqual({ ok: false, code: "not_found" });
  });
});
