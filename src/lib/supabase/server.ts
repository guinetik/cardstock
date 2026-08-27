import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server-side Supabase client bound to the request cookies (server components, actions, route handlers). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => {
          try {
            for (const { name, value, options } of all)
              cookieStore.set(name, value, options);
          } catch {
            // Called from a server component: cookies are read-only there; proxy.ts refreshes them.
          }
        },
      },
    },
  );
}

/** The signed-in member, or null. Membership is the allowlist: an auth user without a members row is not in. */
export async function currentMember() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.email) return null;
  const { data: member } = await db
    .from("members")
    .select("id, email, display_name, role, prefs")
    .eq("email", user.email)
    .maybeSingle();
  return member ? { ...member, authId: user.id } : null;
}
