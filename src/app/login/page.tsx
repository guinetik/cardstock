import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="paper-card w-full max-w-sm space-y-6 p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[27px] leading-tight">cardstock</h1>
            <span className="border border-[var(--border-strong)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]">
              beta
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Invite-only while in beta. Sign in with the email you were invited
            with. Setting a password the first time is the whole onboarding.
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
        <LoginForm next={next} />
      </div>
    </main>
  );
}
