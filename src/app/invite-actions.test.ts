import { afterEach, beforeEach, expect, test } from "bun:test";
import { requestInvite } from "./invite-actions";

const realFetch = globalThis.fetch;
const realKey = process.env.GUINETIK_MAIL_KEY;
const realOwner = process.env.OWNER_EMAIL;

let sent: { to: string[]; subject: string; html: string; text: string } | null =
  null;

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  sent = null;
  process.env.GUINETIK_MAIL_KEY = "gk_live_test";
  process.env.OWNER_EMAIL = "owner@example.com";
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return new Response("{}", { status: 201 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.GUINETIK_MAIL_KEY;
  else process.env.GUINETIK_MAIL_KEY = realKey;
  if (realOwner === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = realOwner;
});

test("a bad address is refused before anything is sent", async () => {
  const result = await requestInvite(null, form({ email: "not an address" }));
  expect(result).toEqual({ error: "Enter a valid email address." });
  expect(sent).toBeNull();
});

test("the owner gets the address, the team and the note", async () => {
  const result = await requestInvite(
    null,
    form({
      email: "Someone@Company.com",
      team: "four of us, one board",
      note: "a client backlog in a spreadsheet",
    }),
  );
  expect(result).toEqual({ ok: true });
  expect(sent?.to).toEqual(["owner@example.com"]);
  expect(sent?.subject).toBe("cardstock invite request: someone@company.com");
  expect(sent?.text).toContain("four of us, one board");
  expect(sent?.text).toContain("a client backlog in a spreadsheet");
});

test("the empty optional fields leave no empty rows behind", async () => {
  await requestInvite(null, form({ email: "someone@company.com" }));
  expect(sent?.html).not.toContain("Team");
  expect(sent?.text).toBe("Invite request\nEmail: someone@company.com");
});

test("angle brackets in the note cannot reach the mail as markup", async () => {
  await requestInvite(
    null,
    form({ email: "someone@company.com", note: "<script>alert(1)</script>" }),
  );
  expect(sent?.html).not.toContain("<script>");
  expect(sent?.html).toContain("&lt;script&gt;");
});

test("a send that fails says so without leaking the reason", async () => {
  globalThis.fetch = (async () =>
    new Response("provider refused", {
      status: 502,
    })) as unknown as typeof fetch;
  const result = await requestInvite(null, form({ email: "a@b.com" }));
  expect(result.ok).toBeUndefined();
  expect(result.error).toContain("did not go through");
  expect(result.error).not.toContain("502");
});
