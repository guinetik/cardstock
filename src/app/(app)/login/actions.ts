"use server";
import { normalizeEmail, passwordProblem } from "@/lib/auth";
import { cleanName, displayNameProblem } from "@/lib/keys";
import { supabaseServer } from "@/lib/supabase/server";

export type LoginResult = { ok?: true; error?: string };

/** Shown whenever an address is not on the allowlist. Deliberately the same
 *  text for "never invited" and "typo", so the form cannot be used to probe
 *  who has an account. */
const NOT_INVITED =
  "cardstock is invite-only while in beta. That email isn't on the list — ask the owner for an invite.";

/** Shown for a wrong password and for an address that has no password yet, so
 *  the form does not report which of the two went wrong. */
const BAD_CREDENTIALS =
  "That email and password don't match. If you were just invited, set your password first.";

/** Sign in with an email and password. */
export async function signIn(
  _prev: LoginResult | null,
  form: FormData,
): Promise<LoginResult> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!email) return { error: "Enter a valid email address." };
  if (!password) return { error: "Enter your password." };

  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { error: BAD_CREDENTIALS };

  // The allowlist, not auth.users, decides who is let in: someone whose invite
  // was withdrawn keeps their credentials but loses their access.
  const { data: member } = await db
    .from("members")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!member) {
    await db.auth.signOut();
    return { error: NOT_INVITED };
  }
  return { ok: true };
}

/**
 * Onboarding: an invited person chooses their password and is signed in.
 *
 * The allowlist is checked first, through the `is_invited` RPC, so no auth user
 * is created for a stranger. `signUp` refuses to touch an account that already
 * has a password, which is what makes this safe to leave open: it can create a
 * first password but never replace one.
 */
export async function setInitialPassword(
  _prev: LoginResult | null,
  form: FormData,
): Promise<LoginResult> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  if (!email) return { error: "Enter a valid email address." };
  const password = String(form.get("password") ?? "");
  const problem = passwordProblem(password, String(form.get("confirm") ?? ""));
  if (problem) return { error: problem };
  const nameProblem = displayNameProblem(String(form.get("displayName") ?? ""));
  const displayName = cleanName(String(form.get("displayName") ?? ""));
  if (nameProblem || !displayName)
    return { error: nameProblem ?? "Enter a name." };

  const db = await supabaseServer();
  const { data: invited, error: rpcError } = await db.rpc("is_invited", {
    p_email: email,
  });
  if (rpcError) return { error: rpcError.message };
  if (!invited) return { error: NOT_INVITED };

  const { data, error } = await db.auth.signUp({ email, password });
  if (error)
    return {
      error:
        // Matched on the code, not the 422 status, which Supabase also uses for
        // a rejected password. Only reachable by someone already on the
        // allowlist, so this reveals nothing to a stranger.
        error.code === "user_already_exists"
          ? "That account has already been set up — sign in instead."
          : error.message,
    };
  // No session means the project still has email confirmations switched on,
  // which would put us back on links. Say so rather than showing a blank page.
  if (!data.session)
    return {
      error:
        "This instance still requires email confirmation. Ask the owner to turn it off.",
    };
  const { error: nameError } = await db
    .from("members")
    .update({ display_name: displayName })
    .eq("email", email);
  if (nameError) return { error: nameError.message };
  return { ok: true };
}
