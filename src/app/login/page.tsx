import { LoginForm } from "./login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = typeof sp.error === "string" ? sp.error : null;
  const allowPassword = process.env.NEXT_PUBLIC_ALLOW_PASSWORD_LOGIN === "1";
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="glass-card w-full max-w-sm space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">cardstock</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with the email you were invited with. We send a link; no
            password.
          </p>
        </div>
        {error === "link" && (
          <p className="text-sm text-destructive">
            That link has expired or was already used. Request a new one.
          </p>
        )}
        {error === "member" && (
          <p className="text-sm text-destructive">
            This board is invite-only. Ask an admin to add your email.
          </p>
        )}
        <LoginForm next={next} allowPassword={allowPassword} />
      </div>
    </main>
  );
}
