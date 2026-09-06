"use server";

import { revalidatePath } from "next/cache";
import { newToken } from "@/lib/api/token";
import { cleanName, displayNameProblem } from "@/lib/keys";
import { type NotificationPrefs, notificationPrefs } from "@/lib/notify";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

export type ProfileResult = { error?: string; success?: string } | null;

/** Update the signed-in member's display name. Email is identity, not a field. */
export async function updateProfile(
  _previous: ProfileResult,
  form: FormData,
): Promise<ProfileResult> {
  const me = await currentMember();
  if (!me) return { error: "Not signed in." };
  const problem = displayNameProblem(String(form.get("displayName") ?? ""));
  if (problem) return { error: problem };
  const displayName = cleanName(String(form.get("displayName") ?? ""));
  if (!displayName) return { error: problem ?? "Enter a name." };

  const db = await supabaseServer();
  const { error } = await db
    .from("members")
    .update({ display_name: displayName })
    .eq("id", me.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/users");
  return { success: "Name saved." };
}

/**
 * Store what board activity may interrupt this member. The value is
 * re-parsed through {@link notificationPrefs} so only the known shape ever
 * lands in prefs, merged beside the board's own keys.
 */
export async function saveNotificationPrefs(
  next: NotificationPrefs,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await currentMember();
  if (!me) return { ok: false, error: "Not signed in." };
  const clean = notificationPrefs(next);
  const db = await supabaseServer();
  const { error } = await db
    .from("members")
    .update({
      prefs: {
        ...((me.prefs ?? {}) as Record<string, unknown>),
        notifications: clean,
      },
    })
    .eq("id", me.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}

/** Mint a personal access token; its plaintext is returned exactly once. */
export async function createCliToken(
  _previous: { error?: string; plaintext?: string } | null,
  form: FormData,
): Promise<{ error?: string; plaintext?: string }> {
  const me = await currentMember();
  if (!me) return { error: "Not signed in." };
  const name = cleanName(String(form.get("name") ?? ""));
  if (!name) return { error: "Give the token a name." };
  const days = Number(form.get("days") ?? 0);
  if (!Number.isFinite(days) || days < 0 || days > 3650)
    return { error: "Expiry must be between 0 and 3650 days." };

  const token = newToken();
  const db = await supabaseServer();
  const { error } = await db.from("cli_tokens").insert({
    id: token.id,
    member_id: me.id,
    name,
    token_hash: token.hash,
    expires_at:
      days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
  });
  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { plaintext: token.plaintext };
}

/** Revoke a token while retaining its audit row. */
export async function revokeCliToken(
  _previous: ProfileResult,
  form: FormData,
): Promise<ProfileResult> {
  const me = await currentMember();
  if (!me) return { error: "Not signed in." };
  const id = String(form.get("id") ?? "");
  if (!id) return { error: "Which token?" };
  const db = await supabaseServer();
  const { error } = await db
    .from("cli_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("member_id", me.id);
  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { success: "Token revoked." };
}
