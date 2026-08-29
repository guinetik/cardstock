# Project members

A project is the tenancy boundary. Who may open a folder is `project_members`;
who may sign in at all is the global `members` allowlist. An invite writes both
in one RPC so a person cannot be allowlisted without a project to land in.

## Where it lives

| Surface | What |
|---|---|
| `/p/[project]` | The roster for this folder. Any project member can see it. The owner can invite and remove. |
| `/users` | The same writes, across every project. Owner-only. |

On the project page the roster is punched slips (`.roster`) inside the People
folder: name as a tab, email in mono, role in the margin, *Remove* to take
someone off this folder. The blank row at the foot is the invite.

## Invite

Owner-only. No email is sent: share the app URL and they set a password on first
visit. `invite_project_member` upserts the allowlist row (role `member`) and the
`project_members` row (`admin` or `member`). Removing someone from a project
leaves them on the allowlist so they can still be attached to another folder.

`src/app/users/actions.ts` is the write path both pages use. After a change it
revalidates `/users` and `/p/<slug>`.
