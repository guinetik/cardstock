import { createClient } from "@supabase/supabase-js";
import { type MailMessage, sendMail } from "@/lib/mail";
import { watchMailHtml } from "@/lib/watch-mail-template";

export interface WatchMail {
  id: string;
  token: string;
  to: string;
  title: string;
  body: string;
  path: string;
}

export function watchMailMessage(
  notice: WatchMail,
  appUrl: string,
): MailMessage {
  const base = new URL(appUrl).origin;
  const href = `${base}${notice.path}`;
  return {
    to: [notice.to],
    subject: `cardstock: ${notice.title.replace(/[\r\n]+/g, " ")}`,
    text: `${notice.title}\n\n${notice.body}\n\nOpen card: ${href}\n\nEmail preferences: ${base}/profile#profile-notifications`,
    html: watchMailHtml({ title: notice.title, body: notice.body, href, base }),
  };
}

/** Atomic claims share a throttle across workers. Failed sends remain queued. */
export async function deliverWatchMail(budgetMs = 45_000) {
  // Local work never contacts the real mail provider unless explicitly enabled.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.CARDSTOCK_NOTIFICATION_EMAILS !== "true"
  )
    return { sent: 0, disabled: true };
  const appUrl =
    process.env.CARDSTOCK_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);
  if (!appUrl || !process.env.GUINETIK_MAIL_KEY)
    throw new Error(
      "Notification mail needs CARDSTOCK_APP_URL and GUINETIK_MAIL_KEY.",
    );
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const deadline = Date.now() + budgetMs;
  let sent = 0;
  while (Date.now() < deadline) {
    const { data, error } = await db.rpc("claim_watch_email");
    if (error) throw new Error(error.message);
    if (!data) break;
    if ("waitMs" in data) {
      const delay = Math.max(50, Number(data.waitMs));
      if (Date.now() + delay >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    const notice = data as WatchMail;
    const result = await sendMail(watchMailMessage(notice, appUrl));
    const { error: finishError } = await db.rpc("finish_watch_email", {
      p_id: notice.id,
      p_token: notice.token,
      p_error: result.ok ? null : result.error,
    });
    if (finishError) throw new Error(finishError.message);
    if (result.ok) sent++;
    else break;
  }
  return { sent, disabled: false };
}
