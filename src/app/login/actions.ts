"use server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { isDevLoginEnabled, isLocalSupabase, normalizeEmail } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export type LoginResult = { ok?: true; error?: string };

/** Shown whenever an address is not on the allowlist. Deliberately the same
 *  text for "never invited" and "typo", so the form cannot be used to probe
 *  who has an account. */
const NOT_INVITED =
  "cardstock is invite-only while in beta. That email isn't on the list — ask the owner for an invite.";

/**
 * Send a magic link, but only to an invited address.
 *
 * The allowlist is checked first, through the `is_invited` RPC: no mail is
 * sent and no auth user is created for a stranger.
 */
export async function requestMagicLink(
  _prev: LoginResult | null,
  form: FormData,
): Promise<LoginResult> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  if (!email) return { error: "Enter a valid email address." };
  const next = String(form.get("next") ?? "/");

  const db = await supabaseServer();
  const { data: invited, error: rpcError } = await db.rpc("is_invited", {
    p_email: email,
  });
  if (rpcError) return { error: rpcError.message };
  if (!invited) return { error: NOT_INVITED };

  const origin = (await headers()).get("origin") ?? "";
  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // The allowlist, not this flag, is the gate — an invited member signing
      // in for the first time still needs their auth user created here.
      shouldCreateUser: true,
    },
  });
  return error ? { error: error.message } : { ok: true };
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
