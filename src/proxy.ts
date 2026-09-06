import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/login", "/auth/"];
// The landing page, matched exactly. It cannot join PUBLIC: those entries are
// prefixes, and "/" is a prefix of every path in the app.
const LANDING = "/";
const API_PREFIX = "/api/v1/";

/** Refresh the Supabase session cookie on every request and gate everything but the landing page, /login and /auth/* behind sign-in. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (all) => {
          for (const { name, value } of all) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of all)
            response.cookies.set(name, value, options);
        },
      },
    },
  );
  const {
    data: { user },
  } = await db.auth.getUser();
  const path = request.nextUrl.pathname;
  // CLI routes authenticate through their bearer-token wrapper, not a browser
  // session. Let them reach it so an invalid token returns API JSON, not HTML.
  const isPublic =
    path === LANDING ||
    path.startsWith(API_PREFIX) ||
    PUBLIC.some((p) => path === p || path.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  // A member has no use for the pitch or a second password box.
  if (user && (path === LANDING || path === "/login"))
    return NextResponse.redirect(new URL("/projects", request.url));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
