"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile } from "./actions";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="mt-5 max-w-md space-y-3">
      <label htmlFor="profile-name" className="block space-y-1.5 text-sm">
        <span className="font-medium">Name</span>
        <Input
          id="profile-name"
          name="displayName"
          required
          maxLength={80}
          defaultValue={displayName}
          autoComplete="name"
        />
      </label>
      <p className="text-xs text-[var(--color-grey)]">
        The portrait is your Gravatar for this email. Cardstock does not store
        photos — <em>Change portrait</em> opens Gravatar’s editor.
      </p>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <output className="block text-sm text-foreground">
          {state.success}
        </output>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}
