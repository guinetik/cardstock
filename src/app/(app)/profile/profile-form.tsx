"use client";

import { useActivityActionState as useActionState } from "@/components/activity";
import { updateProfile } from "./actions";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form
      data-saving={pending || undefined}
      aria-busy={pending || undefined}
      action={action}
    >
      <div className="identity-fields">
        <label htmlFor="profile-name">
          <span>Name</span>
          <input
            id="profile-name"
            name="displayName"
            required
            maxLength={80}
            defaultValue={displayName}
            placeholder="Your name"
            autoComplete="name"
          />
        </label>
        <button type="submit" className="roster-invite-go" disabled={pending}>
          {pending ? "Saving…" : "Save name"}
        </button>
      </div>
      <p className="identity-note">
        The portrait is your Gravatar for this email. Cardstock does not store
        photos — <em>Change portrait</em> opens Gravatar’s editor.
      </p>
      {state?.error && (
        <p className="identity-note text-[var(--pen-red)]" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <output className="identity-note block text-[var(--color-ink)]">
          {state.success}
        </output>
      )}
    </form>
  );
}
