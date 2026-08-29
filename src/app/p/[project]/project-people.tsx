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
 * English count for the roster — "1 person" vs "2 people".
 */
function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Who can open this folder, drawn as one wide binder of full-width rows. The
 * owner invites on the blank sheet at the foot; removing someone leaves them
 * on the allowlist.
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
    <section
      className="binder binder--wide roster"
      aria-labelledby="people-heading"
    >
      <span className="binder-rivets" aria-hidden="true" />
      <header className="roster-head">
        <h2 id="people-heading" className="binder-name">
          People
        </h2>
        <span className="binder-count">
          {plural(people.length, "person", "people")}
        </span>
      </header>
      <ul className="roster-slips" aria-label="People">
        {people.map((person) => {
          const name = person.displayName ?? person.email;
          const you = person.memberId === currentMemberId;
          return (
            <li key={person.memberId} className="roster-slip">
              <span className="roster-punch" aria-hidden="true" />
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
    </section>
  );
}
