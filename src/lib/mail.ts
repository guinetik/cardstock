/**
 * Outbound mail, borrowed from the parent backend.
 *
 * cardstock does not own a mail provider and is not going to. The guinetik
 * backend already holds the provider config, the key rotation and the send
 * throttle, and exposes `POST /email/send` behind a managed API key. This is
 * the whole client: one call, no SDK, no queue.
 *
 * The endpoint is throttled at 10 sends a minute, so callers are expected to
 * validate before they send rather than lean on a retry.
 *
 * Server side only. There is no `server-only` import because the package is
 * not installed and this module is unit tested; what keeps the key off the
 * browser is that `GUINETIK_MAIL_KEY` carries no `NEXT_PUBLIC_` prefix, so a
 * client bundle would read `undefined` and send nothing.
 */

const DEFAULT_URL = "https://api.guinetik.com";

export interface MailMessage {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export type MailResult = { ok: true } | { ok: false; error: string };

/**
 * Post a message and say plainly whether it left. Never throws: a landing-page
 * form has nothing useful to do with a stack trace, and a provider being down
 * is not the visitor's problem to read.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const key = process.env.GUINETIK_MAIL_KEY;
  if (!key) return { ok: false, error: "Mail is not configured." };
  const base = (process.env.GUINETIK_MAIL_URL || DEFAULT_URL).replace(
    /\/+$/,
    "",
  );
  try {
    const response = await fetch(`${base}/email/send`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Mail service returned ${response.status}. ${detail}`.trim(),
      };
    }
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Mail service is down.",
    };
  }
}

/** Who hears about an invite request. The address that owns the deployment. */
export function ownerAddress(): string | null {
  return process.env.OWNER_EMAIL || null;
}
