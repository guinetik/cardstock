"use client";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { devSignIn, type LoginResult, requestMagicLink } from "./actions";

export function LoginForm({
  next,
  devLogin,
}: {
  next: string;
  devLogin: boolean;
}) {
  const [email, setEmail] = useState("");
  const [linkState, sendLink, sendingLink] = useActionState<
    LoginResult | null,
    FormData
  >(requestMagicLink, null);
  const [devState, signInDev, signingInDev] = useActionState<
    LoginResult | null,
    FormData
  >(devSignIn, null);

  useEffect(() => {
    // The session cookie is set; a full load lets proxy.ts pick it up.
    if (devState?.ok) window.location.assign(next);
  }, [devState?.ok, next]);

  if (linkState?.ok)
    return (
      <p className="text-sm">
        Check your inbox — the link signs you in on this device.
      </p>
    );

  const error = linkState?.error ?? devState?.error;

  return (
    <div className="space-y-6">
      <form
        action={sendLink}
        className="space-y-3"
        data-testid="magic-link-form"
      >
        <input type="hidden" name="next" value={next} />
        <Input
          type="email"
          name="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <Button type="submit" className="w-full" disabled={sendingLink}>
          {sendingLink ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>
      {devLogin && (
        <form
          action={signInDev}
          className="space-y-3 border-t pt-4"
          data-testid="dev-login-form"
        >
          <input type="hidden" name="email" value={email} />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={signingInDev}
          >
            {signingInDev ? "Signing in…" : "Sign in (local dev)"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Local development only — no password. The invite list still applies.
          </p>
        </form>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
