# Homepage redesign (#20)

The signed-out face of cardstock. Today `/` bounces a visitor to `/login`, so the
product has no public page at all: a link to the site is a link to a password box.
This replaces that with a landing page that carries the sign-in form on it, built
from the concept in `tmp/invite-homepage/Homepage.dc.html` (Claude Design).

## Decisions

| Question | Answer |
|---|---|
| Where does the landing live | `/`, with the working sign-in in the left rail, as the concept draws it |
| Where does the projects binder go | `/projects` |
| Does `/login` survive | Yes, unchanged, for direct links and the proxy's redirect target |
| What does the invite form do | Sends the owner an email through the guinetik mail API. No table, no row |
| Where does the demo content come from | A hand-written fixture, rendered through the real paper classes |

## Routing

The root layout paints a topbar on every route. The landing has its own rail and
nav and must not carry it, so the topbar moves down one level into a route group:

```
src/app/layout.tsx          html, fonts, theme bootstrap. No chrome.
src/app/page.tsx            the landing. Public.
src/app/(app)/layout.tsx    the topbar. Wraps everything that needs a session.
src/app/(app)/projects/     the binder that used to be at /
src/app/(app)/{p,profile,users,cli,login}/   moved verbatim
```

The group is parentheses, so no URL changes. `actions.ts` and `import-actions.ts`
stay at `src/app/` where `@/app/actions` already points; every other action import
is relative and travels with its own directory.

`proxy.ts` gains `/` in `PUBLIC`, and its two redirects retarget:

- signed out, hitting a gated path: `/login?next=...`, as before
- signed in, hitting `/` or `/login`: `/projects`

## Mail

There is no mail sender in this repo and there will not be one. The parent
backend (`guinetik-backend-email`) already owns provider config, key management
and throttling; cardstock only borrows it.

```
POST $GUINETIK_MAIL_URL/email/send
X-Api-Key: gk_live_...
{ to: [OWNER_EMAIL], subject, html, text }
```

`src/lib/mail.ts` is the whole client: one `sendMail()` that posts, and returns
`{ ok }` or `{ ok: false, error }`. It never throws at the caller. Three new env
entries, documented in `.env.example`:

- `GUINETIK_MAIL_URL` (default `https://api.guinetik.com`)
- `GUINETIK_MAIL_KEY`
- `OWNER_EMAIL` already exists and is the recipient

The endpoint is throttled at 10 requests a minute, so the invite action is the
only caller and it validates before it sends.

## The page

Sections in order, following the concept:

1. Left rail: wordmark, beta stamp, sign-in card (the existing `LoginForm`),
   invite link, a mono line of counts
2. Nav, hero, and a board strip: five lanes of fixture cards
3. A metric strip: four mono facts
4. `01` file and app: the same item as markdown and as a filed card
5. `02` the unsorted drawer and why it ages
6. `03` folders and binders
7. `04` epics and their outlook, plus pen and highlighter
8. `05` the calendar month
9. Mid-page invite CTA (email only)
10. `06` Not built yet, stated flatly
11. Bottom invite CTA (email, team, what you would file)
12. Footer

## Copy

House voice, with two rules from the ask on top of it: no em dashes anywhere,
and no "not X, but Y" construction. Everything else follows the design system's
content fundamentals. Sentence case, reasons rather than rules, mono for
anything a machine counted, and the "Not built yet" list says what is missing
without hedging.

## Tests

- `src/lib/mail.test.ts`: posts the right shape, carries the key, reports a
  provider rejection instead of throwing
- `src/app/invite-actions.test.ts`: rejects a bad address before it sends
- `e2e/homepage.spec.ts`: the landing renders signed out, the rail signs a member
  in and lands them on `/projects`, and a signed-in visitor to `/` is redirected
