import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { newToken, parseToken, verifyToken } from "./token";

const REQUEST_LIFETIME_SECONDS = 600;
export const POLL_INTERVAL_SECONDS = 3;

function serviceDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function userCode(): string {
  return Array.from(
    randomBytes(8),
    (byte) => alphabet[byte % alphabet.length],
  ).join("");
}

export async function startCliLogin(deviceName: string) {
  const db = serviceDb();
  const deviceCode = randomBytes(32).toString("base64url");
  const code = userCode();
  const { error } = await db.from("cli_login_requests").insert({
    user_code: code,
    device_hash: hash(deviceCode),
    device_name: deviceName,
    expires_at: new Date(
      Date.now() + REQUEST_LIFETIME_SECONDS * 1000,
    ).toISOString(),
  });
  if (error) throw new Error(error.message);
  return { userCode: code, deviceCode };
}

export async function pollCliLogin(deviceCode: string) {
  const db = serviceDb();
  const token = newToken();
  const { data: memberId, error } = await db.rpc("complete_cli_login", {
    p_device_hash: hash(deviceCode),
    p_token_id: token.id,
    p_token_name: "CLI login",
    p_token_hash: token.hash,
  });
  if (error) throw new Error(error.message);
  if (!memberId) return null;
  const { data: member } = await db
    .from("members")
    .select("email")
    .eq("id", memberId)
    .single();
  if (!member) throw new Error("The approved member no longer exists.");
  return { token: token.plaintext, email: member.email as string };
}

/** Revoke the token presented by a CLI before it forgets its local copy. */
export async function revokeCliLogin(header: string | null): Promise<boolean> {
  const db = serviceDb();
  const parsed = parseToken(header);
  if (!parsed || !(await verifyToken(db, header)).ok) return false;
  const { error } = await db
    .from("cli_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.id);
  if (error) throw new Error(error.message);
  return true;
}
