# Project members

A project is the tenancy boundary. Who may open a folder is `project_members`;
who may sign in at all is the global `members` allowlist. An invite writes both
in one RPC so a person cannot be allowlisted without a project to land in.

There is exactly one **Owner**: whoever deploys, bootstrapped from
`OWNER_EMAIL`. Admin is a **project** role, not a site role.

## Roles

| | Owner | Project admin | Project member |
|---|---|---|---|
| See this project | every project | yes | yes |
| `/users` | yes | no | no |
| Create / import a project | yes | no | no |
| Create a board | yes | yes | no |
| Import / export a board | yes | yes | no |
| Invite a member | yes | yes | no |
| Invite a project admin | yes | no | no |
| Remove a member | yes | yes | no |
| Remove a project admin | yes | no | no |
| Edit cards, lanes, tags | yes | yes | yes |
| Comment | yes | yes | yes |

## Where it lives

| Surface | What |
|---|---|
| `/p/[project]` | The roster for this folder. Any project member can see it. The owner or a project admin can invite and remove (admins invite members only). |
| `/users` | The same writes, across every project. Owner-only. |
| `/profile` | Your name, Gravatar portrait (Quick Editor to change it), and **My cardstock**. Anyone signed in. |

On the project page the roster is wide binders (`.roster`) inside the People
folder: a square Gravatar, name as a tab, email in mono, role in the margin,
*Remove* to take someone off this folder. The blank binder at the foot is the
invite. Every person has a name — invite requires one, and they can change it
on `/profile`. The portrait is their Gravatar for that email.

## Invite

No email is sent: share the app URL and they set a password and confirm their
name on first visit.
`invite_project_member` upserts the allowlist row (site role `member`) and the
`project_members` row (`admin` or `member`). Only the owner may pass `admin`.
Removing someone from a project leaves them on the allowlist so they can still
be attached to another folder.

`src/app/users/actions.ts` is the write path both pages use. After a change it
revalidates `/users` and `/p/<slug>`.
