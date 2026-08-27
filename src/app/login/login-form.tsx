"use client";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD } from "@/lib/auth";
import {
  devSignIn,
  type LoginResult,
  setInitialPassword,
  signIn,
} from "./actions";

export function LoginForm({
  next,
  devLogin,
}: {
  next: string;
  devLogin: boolean;
}) {
  const [email, setEmail] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [inState, doSignIn, signingIn] = useActionState<
    LoginResult | null,
    FormData
  >(signIn, null);
  const [pwState, doSetPassword, settingPassword] = useActionState<
    LoginResult | null,
    FormData
  >(setInitialPassword, null);
  const [devState, signInDev, signingInDev] = useActionState<
    LoginResult | null,
    FormData
  >(devSignIn, null);

  const ok = inState?.ok || pwState?.ok || devState?.ok;
  useEffect(() => {
    // The session cookie is set; a full load lets proxy.ts pick it up.
    if (ok) window.location.assign(next);
  }, [ok, next]);

  const error = inState?.error ?? pwState?.error ?? devState?.error;
  const busy = signingIn || settingPassword;

  return (
    <div className="space-y-6">
      <form
        action={onboarding ? doSetPassword : doSignIn}
        className="space-y-3"
        data-testid={onboarding ? "set-password-form" : "sign-in-form"}
        // Remount on switch so the browser does not carry the typed password
        // from one mode into the other.
        key={onboarding ? "onboard" : "signin"}
      >
        <Input
          type="email"
          name="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <Input
          type="password"
          name="password"
          required
          minLength={onboarding ? MIN_PASSWORD : undefined}
          autoComplete={onboarding ? "new-password" : "current-password"}
          placeholder={onboarding ? "Choose a password" : "Password"}
          aria-label={onboarding ? "New password" : "Password"}
        />
        {onboarding && (
          <Input
            type="password"
            name="confirm"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            placeholder="Confirm password"
            aria-label="Confirm password"
          />
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy
            ? "Working…"
            : onboarding
              ? "Set password and sign in"
              : "Sign in"}
        </Button>
      </form>
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2"
        onClick={() => setOnboarding((v) => !v)}
        data-testid="toggle-onboarding"
      >
        {onboarding
          ? "Already have a password? Sign in"
          : "First time here? Set your password"}
      </button>
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
