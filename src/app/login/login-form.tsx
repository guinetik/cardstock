"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm({
  next,
  allowPassword,
}: {
  next: string;
  allowPassword: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const db = supabaseBrowser();
    const { error } = await db.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const db = supabaseBrowser();
    const { error } = await db.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
    else window.location.assign(next);
  }

  if (sent)
    return (
      <p className="text-sm">
        Check your inbox — the link signs you in on this device.
      </p>
    );

  return (
    <div className="space-y-6">
      <form
        onSubmit={sendLink}
        className="space-y-3"
        data-testid="magic-link-form"
      >
        <Input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>
      {allowPassword && (
        <form
          onSubmit={signInWithPassword}
          className="space-y-3 border-t pt-4"
          data-testid="password-form"
        >
          <p className="text-xs text-muted-foreground">
            Local development only — password sign-in.
          </p>
          <Input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Password"
          />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={busy}
          >
            Sign in with password
          </Button>
        </form>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );
}
