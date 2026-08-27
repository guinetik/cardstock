import { isDevLoginEnabled } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = typeof sp.error === "string" ? sp.error : null;
  const devLogin = isDevLoginEnabled({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_DEV_LOGIN: process.env.NEXT_PUBLIC_DEV_LOGIN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="glass-card w-full max-w-sm space-y-6 p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">cardstock</h1>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              beta
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Invite-only while in beta. Enter the email you were invited with and
            we&rsquo;ll send you a sign-in link — no password.
          </p>
        </div>
        {error === "link" && (
          <p className="text-sm text-destructive">
            That link has expired or was already used. Request a new one.
          </p>
        )}
        {error === "member" && (
          <p className="text-sm text-destructive">
            That email isn&rsquo;t on the invite list. Ask the owner for an
            invite.
          </p>
        )}
        <LoginForm next={next} devLogin={devLogin} />
      </div>
    </main>
  );
}
