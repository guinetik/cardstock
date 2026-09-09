import { afterEach, beforeEach, expect, test } from "bun:test";
import { POST } from "@/app/api/v1/notifications/deliver/route";
import { deliverWatchMail } from "./watch-mail";

const keys = [
  "GUINETIK_MAIL_URL",
  "GUINETIK_MAIL_KEY",
  "CARDSTOCK_APP_URL",
  "CARDSTOCK_NOTIFICATION_EMAILS",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "NODE_ENV",
] as const;
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const job = {
  id: "notice",
  token: "lease",
  to: "person@example.test",
  title: "Hap is watching #24",
  body: "Project / Board",
  path: "/p/project/b/board/c/24",
};

beforeEach(() => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    CARDSTOCK_NOTIFICATION_EMAILS: "true",
    CARDSTOCK_APP_URL: "https://app.example.test",
    GUINETIK_MAIL_URL: "https://mail.example.test",
    GUINETIK_MAIL_KEY: "test-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://db.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    CRON_SECRET: "test-worker-secret",
  });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else Object.assign(process.env, { [key]: saved[key] });
  }
});

for (const status of [200, 429]) {
  test(`delivery records ${status === 200 ? "success" : "failure for retry"} using the claimed lease`, async () => {
    let claims = 0;
    let finished: Record<string, unknown> | undefined;
    let envelope: { to: string[]; html: string } | undefined;
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/claim_watch_email"))
        return Response.json(claims++ === 0 ? job : null);
      if (path.endsWith("/finish_watch_email")) {
        finished = JSON.parse(String(init?.body));
        return Response.json(null);
      }
      if (path === "/email/send") {
        envelope = JSON.parse(String(init?.body));
        return new Response(status === 200 ? "{}" : "Throttled", { status });
      }
      throw new Error("Unexpected network request");
    }) as typeof fetch;
    const result = await deliverWatchMail(1000);
    expect(result.sent).toBe(status === 200 ? 1 : 0);
    expect(envelope?.to).toEqual(["person@example.test"]);
    expect(finished?.p_id).toBe("notice");
    expect(finished?.p_token).toBe("lease");
    if (status === 200) expect(finished?.p_error).toBeNull();
    else expect(String(finished?.p_error)).toContain("429");
  });
}

test("local development and unauthorized worker requests send nothing", async () => {
  Object.assign(process.env, { CARDSTOCK_NOTIFICATION_EMAILS: "false" });
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error("No network expected");
  }) as unknown as typeof fetch;
  expect((await deliverWatchMail()).disabled).toBe(true);
  expect(
    (
      await POST(
        new Request("https://app.example.test/api/v1/notifications/deliver"),
      )
    ).status,
  ).toBe(401);
  expect(calls).toBe(0);
});
