"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteUser } from "./actions";

export function InviteUserForm({
  projects,
}: {
  projects: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(inviteUser, null);
  return (
    <form action={action} className="paper-card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Invite to a project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No email is sent. Share the app URL; the user sets a password on their
          first visit.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="invite-email" className="space-y-1.5 text-sm">
          <span className="font-medium">Email</span>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="name@company.com"
          />
        </label>
        <label htmlFor="invite-name" className="space-y-1.5 text-sm">
          <span className="font-medium">Display name</span>
          <Input
            id="invite-name"
            name="displayName"
            maxLength={80}
            placeholder="Optional"
          />
        </label>
        <div className="space-y-1.5 text-sm">
          <label htmlFor="invite-project" className="block font-medium">
            Project
          </label>
          <select
            id="invite-project"
            name="projectId"
            required
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Choose a project
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 text-sm">
          <label htmlFor="invite-role" className="block font-medium">
            Role
          </label>
          <select
            id="invite-role"
            name="role"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            defaultValue="member"
          >
            <option value="member">Member</option>
            <option value="admin">Project admin</option>
          </select>
        </div>
      </div>
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
      <Button type="submit" disabled={pending || !projects.length}>
        {pending ? "Saving…" : "Invite user"}
      </Button>
    </form>
  );
}
