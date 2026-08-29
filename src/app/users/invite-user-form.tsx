"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteUser } from "./actions";

/**
 * Allowlist a person and attach them to a project. No mail is sent; they set a
 * password on first visit. `lockedProjectId` hides the project picker so the
 * project page can invite into the folder already open. `slip` draws the form
 * as the blank sheet at the foot of the roster binder.
 */
export function InviteUserForm({
  projects,
  lockedProjectId,
  variant = "card",
}: {
  projects: Array<{ id: string; name: string }>;
  lockedProjectId?: string;
  variant?: "card" | "slip";
}) {
  const [state, action, pending] = useActionState(inviteUser, null);
  if (variant === "slip") {
    return (
      <form action={action} className="roster-slip roster-slip--blank">
        <span className="roster-punch" aria-hidden="true" />
        <div className="roster-invite">
          <div>
            <p className="roster-invite-kicker">Invite someone</p>
            <p className="roster-invite-lead">
              No email is sent. Share the app URL; they set a password on their
              first visit.
            </p>
          </div>
          <InviteFields
            projects={projects}
            lockedProjectId={lockedProjectId}
            pending={pending}
            error={state?.error}
            success={state?.success}
            slip
          />
        </div>
      </form>
    );
  }
  return (
    <form action={action} className="paper-card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Invite to a project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No email is sent. Share the app URL; the user sets a password on their
          first visit.
        </p>
      </div>
      <InviteFields
        projects={projects}
        lockedProjectId={lockedProjectId}
        pending={pending}
        error={state?.error}
        success={state?.success}
      />
    </form>
  );
}

/**
 * Shared fields for both the Users card and the roster slip. IDs stay unique
 * because a page never mounts both variants.
 */
function InviteFields({
  projects,
  lockedProjectId,
  pending,
  error,
  success,
  slip = false,
}: {
  projects: Array<{ id: string; name: string }>;
  lockedProjectId?: string;
  pending: boolean;
  error?: string;
  success?: string;
  slip?: boolean;
}) {
  const fieldClass = slip ? "roster-fields" : "grid gap-3 sm:grid-cols-2";
  return (
    <>
      <div className={fieldClass}>
        <label
          htmlFor="invite-email"
          className={slip ? undefined : "space-y-1.5 text-sm"}
        >
          <span className={slip ? undefined : "font-medium"}>Email</span>
          {slip ? (
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="name@company.com"
            />
          ) : (
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="name@company.com"
            />
          )}
        </label>
        <label
          htmlFor="invite-name"
          className={slip ? undefined : "space-y-1.5 text-sm"}
        >
          <span className={slip ? undefined : "font-medium"}>Display name</span>
          {slip ? (
            <input
              id="invite-name"
              name="displayName"
              maxLength={80}
              placeholder="Optional"
            />
          ) : (
            <Input
              id="invite-name"
              name="displayName"
              maxLength={80}
              placeholder="Optional"
            />
          )}
        </label>
        {lockedProjectId ? (
          <input type="hidden" name="projectId" value={lockedProjectId} />
        ) : (
          <div className={slip ? undefined : "space-y-1.5 text-sm"}>
            <label
              htmlFor="invite-project"
              className={slip ? undefined : "block font-medium"}
            >
              Project
            </label>
            <select
              id="invite-project"
              name="projectId"
              required
              className={
                slip
                  ? undefined
                  : "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              }
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
        )}
        <label
          htmlFor="invite-role"
          className={slip ? undefined : "space-y-1.5 text-sm"}
        >
          <span className={slip ? undefined : "font-medium"}>Role</span>
          <select
            id="invite-role"
            name="role"
            className={
              slip
                ? undefined
                : "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            }
            defaultValue="member"
          >
            <option value="member">Member</option>
            <option value="admin">Project admin</option>
          </select>
        </label>
        {slip && (
          <button
            type="submit"
            className="roster-invite-go"
            disabled={pending || !projects.length}
          >
            {pending ? "Saving…" : "Invite user"}
          </button>
        )}
        {slip && error && (
          <p className="roster-invite-note text-destructive" role="alert">
            {error}
          </p>
        )}
        {slip && success && (
          <output className="roster-invite-note block text-foreground">
            {success}
          </output>
        )}
      </div>
      {!slip && (
        <>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {success && (
            <output className="block text-sm text-foreground">{success}</output>
          )}
          <Button type="submit" disabled={pending || !projects.length}>
            {pending ? "Saving…" : "Invite user"}
          </Button>
        </>
      )}
    </>
  );
}
