import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Magic-link landing: exchange the code for a session, then send the member on.
 *
 * A valid link is not enough. The allowlist is the gate, so an auth user
 * without a `members` row is signed straight back out — otherwise they would
 * hold a session and simply see empty pages, which reads like a bug rather
 * than a closed door.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  if (code) {
    const db = await supabaseServer();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const email = data.user?.email;
      const { data: member } = email
        ? await db.from("members").select("id").eq("email", email).maybeSingle()
        : { data: null };
      if (member) return NextResponse.redirect(new URL(next, url.origin));
      await db.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=member", url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
