import { removeMembership } from "@/app/users/actions";
import { InviteUserForm } from "@/app/users/invite-user-form";

/** One row on the project roster: allowlist identity plus project role. */
export type ProjectPerson = {
  memberId: string;
  email: string;
  displayName: string | null;
  role: string;
};

/**
 * Who can open this folder, as wide binders on the People section's stock.
 * The owner invites on the blank cover at the foot; removing someone leaves
 * them on the allowlist.
 */
export function ProjectPeople({
  projectId,
  projectName,
  people,
  currentMemberId,
  canInvite,
}: {
  projectId: string;
  projectName: string;
  people: ProjectPerson[];
  currentMemberId: string;
  canInvite: boolean;
}) {
  return (
    <div className="roster">
      <ul className="roster-slips" aria-label="People">
        {people.map((person) => {
          const name = person.displayName ?? person.email;
          const you = person.memberId === currentMemberId;
          return (
            <li
              key={person.memberId}
              className="binder binder--wide roster-slip"
            >
              <span className="binder-rivets" aria-hidden="true" />
              <div className="roster-who">
                <span className="roster-name">
                  {name}
                  {you && <span className="roster-you">you</span>}
                </span>
                {person.displayName && (
                  <span className="roster-mail">{person.email}</span>
                )}
              </div>
              <div className="roster-meta">
                <span className="stat stat--flat">{person.role}</span>
                {canInvite && !you && (
                  <form action={removeMembership}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input
                      type="hidden"
                      name="memberId"
                      value={person.memberId}
                    />
                    <button
                      type="submit"
                      className="paper-link paper-link--danger"
                      aria-label={`Remove ${person.email} from ${projectName}`}
                    >
                      Remove
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {canInvite && (
        <InviteUserForm
          variant="slip"
          projects={[{ id: projectId, name: projectName }]}
          lockedProjectId={projectId}
        />
      )}
    </div>
  );
}
