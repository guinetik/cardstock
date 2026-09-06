import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ownerAddress, sendMail } from "./mail";

const MESSAGE = {
  to: ["owner@example.com"],
  subject: "cardstock invite request: you@company.com",
  html: "<h2>Invite request</h2>",
  text: "Invite request",
};

const realFetch = globalThis.fetch;
const realKey = process.env.GUINETIK_MAIL_KEY;
const realUrl = process.env.GUINETIK_MAIL_URL;
const realOwner = process.env.OWNER_EMAIL;

/** The last request the client made, so a test can read what went up. */
let sent: { url: string; init: RequestInit } | null = null;

function stubFetch(response: Response | (() => never)) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent = { url, init };
    if (typeof response === "function") response();
    return response;
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  sent = null;
  process.env.GUINETIK_MAIL_KEY = "gk_live_test";
  process.env.GUINETIK_MAIL_URL = "https://mail.example.com";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.GUINETIK_MAIL_KEY;
  else process.env.GUINETIK_MAIL_KEY = realKey;
  if (realUrl === undefined) delete process.env.GUINETIK_MAIL_URL;
  else process.env.GUINETIK_MAIL_URL = realUrl;
  if (realOwner === undefined) delete process.env.OWNER_EMAIL;
  else process.env.OWNER_EMAIL = realOwner;
});

describe("sendMail", () => {
  test("posts the message to the send endpoint with the key", async () => {
    stubFetch(new Response("{}", { status: 201 }));
    const result = await sendMail(MESSAGE);
    expect(result.ok).toBe(true);
    expect(sent?.url).toBe("https://mail.example.com/email/send");
    expect(sent?.init.method).toBe("POST");
    const headers = sent?.init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("gk_live_test");
    expect(JSON.parse(String(sent?.init.body))).toEqual(MESSAGE);
  });

  test("does not double the slash when the base url carries one", async () => {
    process.env.GUINETIK_MAIL_URL = "https://mail.example.com/";
    stubFetch(new Response("{}", { status: 201 }));
    await sendMail(MESSAGE);
    expect(sent?.url).toBe("https://mail.example.com/email/send");
  });

  test("reports a provider rejection rather than throwing", async () => {
    stubFetch(new Response("provider refused", { status: 502 }));
    const result = await sendMail(MESSAGE);
    expect(result).toEqual({
      ok: false,
      error: "Mail service returned 502. provider refused",
    });
  });

  test("reports a dead endpoint rather than throwing", async () => {
    stubFetch(() => {
      throw new Error("connect ECONNREFUSED");
    });
    const result = await sendMail(MESSAGE);
    expect(result).toEqual({ ok: false, error: "connect ECONNREFUSED" });
  });

  test("sends nothing at all when there is no key", async () => {
    delete process.env.GUINETIK_MAIL_KEY;
    stubFetch(new Response("{}", { status: 201 }));
    const result = await sendMail(MESSAGE);
    expect(result).toEqual({ ok: false, error: "Mail is not configured." });
    expect(sent).toBeNull();
  });
});

describe("ownerAddress", () => {
  test("is the deployment owner", () => {
    process.env.OWNER_EMAIL = "owner@example.com";
    expect(ownerAddress()).toBe("owner@example.com");
  });

  test("is null when unset, so a caller can say so", () => {
    delete process.env.OWNER_EMAIL;
    expect(ownerAddress()).toBeNull();
  });
});
