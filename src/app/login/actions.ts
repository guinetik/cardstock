"use server";
import { createClient } from "@supabase/supabase-js";
import {
  isDevLoginEnabled,
  isLocalSupabase,
  normalizeEmail,
  passwordProblem,
} from "@/lib/auth";
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
        // Only reachable by someone already on the allowlist, so this reveals
        // nothing to a stranger.
        error.status === 422
          ? "That account already has a password — sign in with it instead."
          : error.message,
    };
  // No session means the project still has email confirmations switched on,
  // which would put us back on links. Say so rather than showing a blank page.
  if (!data.session)
    return {
      error:
        "This instance still requires email confirmation. Ask the owner to turn it off.",
    };
  return { ok: true };
}

/**
 * Local development only: sign in with an email and no password.
 *
 * Refuses unless this is a non-production build talking to a Supabase on this
 * machine, so it cannot fire on a deployed instance even if the env var leaks.
 * The allowlist still applies.
 */
export async function devSignIn(
  _prev: LoginResult | null,
  form: FormData,
): Promise<LoginResult> {
  if (
    !isDevLoginEnabled({
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_DEV_LOGIN: process.env.NEXT_PUBLIC_DEV_LOGIN,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    })
  )
    return { error: "Dev sign-in is not available here." };

  const email = normalizeEmail(String(form.get("email") ?? ""));
  if (!email) return { error: "Enter a valid email address." };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !isLocalSupabase(url))
    return { error: "SUPABASE_SERVICE_ROLE_KEY is required for dev sign-in." };

  const admin = createClient(url as string, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: member } = await admin
    .from("members")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (!member) return { error: NOT_INVITED };

  // An invited member may not have an auth user yet — the allowlist is the
  // record of who may sign in, not auth.users.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email);
  if (!existing) {
    const { error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) return { error: error.message };
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link?.properties?.hashed_token)
    return { error: linkError?.message ?? "Could not create a dev session." };

  const db = await supabaseServer();
  const { error } = await db.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  return error ? { error: error.message } : { ok: true };
}
