/** Configure the durable minute-by-minute delivery job after deploying the app.
 * Uses bound SQL values for secrets; never prints credentials or connection URLs.
 */
import postgres from "postgres";

const dbUrl = process.env.SUPABASE_DB_URL;
const appUrl = process.env.CARDSTOCK_APP_URL;
const secret = process.env.CRON_SECRET;
if (!dbUrl || !appUrl || !secret || secret.length < 32)
  throw new Error(
    "Set SUPABASE_DB_URL, CARDSTOCK_APP_URL and CRON_SECRET (at least 32 characters).",
  );
const origin = new URL(appUrl).origin;
if (!origin.startsWith("https://"))
  throw new Error("CARDSTOCK_APP_URL must use HTTPS.");

const db = postgres(dbUrl, { max: 1, onnotice: () => {} });
try {
  await db.begin(async (tx) => {
    await tx`create extension if not exists pg_cron`;
    await tx`create extension if not exists pg_net with schema extensions`;
    for (const [name, value] of [
      ["cardstock_watch_mail_url", `${origin}/api/v1/notifications/deliver`],
      ["cardstock_watch_mail_secret", secret],
    ]) {
      const rows = await tx`select id from vault.secrets where name=${name}`;
      if (rows.length)
        await tx`select vault.update_secret(${rows[0].id}::uuid, ${value}, ${name})`;
      else await tx`select vault.create_secret(${value}, ${name})`;
    }
    await tx`select cron.schedule('cardstock-watch-mail', '* * * * *', ${"select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name='cardstock_watch_mail_url'), headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='cardstock_watch_mail_secret')), body := '{}'::jsonb, timeout_milliseconds := 60000);"})`;
  });
  console.log("Watch email delivery scheduled every minute.");
} catch {
  // Database error objects can contain bound parameters, including secrets.
  throw new Error(
    "Could not configure watch delivery. Check database access and pg_cron, pg_net, and Vault availability.",
  );
} finally {
  await db.end();
}
