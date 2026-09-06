import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TOKEN_PREFIX = "cst_";
const tokenRe = /^cst_([A-Za-z0-9_-]{8})_([A-Za-z0-9_-]{43})$/;

export interface TokenMember {
  id: string;
  email: string;
  role: string;
}

export type VerifyResult = { ok: true; member: TokenMember } | { ok: false };

/** SHA-256 is sufficient because the token secret is 256 random bits. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function newToken(): {
  id: string;
  secret: string;
  plaintext: string;
  hash: string;
} {
  const id = randomBytes(6).toString("base64url").slice(0, 8);
  const secret = randomBytes(32).toString("base64url");
  return {
    id,
    secret,
    plaintext: `${TOKEN_PREFIX}${id}_${secret}`,
    hash: hashSecret(secret),
  };
}

/** The two halves of a well-formed bearer token, or null without a query. */
export function parseToken(
  header: string | null,
): { id: string; secret: string } | null {
  const match = /^\s*Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  if (!match) return null;
  const parts = tokenRe.exec(match[1]);
  return parts ? { id: parts[1], secret: parts[2] } : null;
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Resolve a bearer token to its member without revealing why a check failed. */
export async function verifyToken(
  db: SupabaseClient,
  header: string | null,
): Promise<VerifyResult> {
  const parsed = parseToken(header);
  if (!parsed) return { ok: false };

  const { data: row } = await db
    .from("cli_tokens")
    .select("id, member_id, token_hash, expires_at, revoked_at")
    .eq("id", parsed.id)
    .maybeSingle();
  if (!row || !sameHash(row.token_hash as string, hashSecret(parsed.secret)))
    return { ok: false };
  if (row.revoked_at) return { ok: false };
  if (row.expires_at && new Date(row.expires_at as string) <= new Date())
    return { ok: false };

  const { data: member } = await db
    .from("members")
    .select("id, email, role")
    .eq("id", row.member_id as string)
    .maybeSingle();
  if (!member) return { ok: false };

  void db
    .from("cli_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", parsed.id)
    .then(undefined, () => {});

  return {
    ok: true,
    member: {
      id: member.id as string,
      email: member.email as string,
      role: member.role as string,
    },
  };
}
