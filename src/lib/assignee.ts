/**
 * One assignee, two roster-aware surfaces. The card select and the filter
 * chips both label a person through here so a name never reads two ways.
 *
 * The history line does not go through this module: `card-history.ts` only
 * has the email a `card_events` payload carries, no roster to resolve it
 * against, so it capitalises the local part instead of looking up a
 * `display_name`. That is why the same person can read `Ana Silva` in the
 * filter and `Ana` in the history — both are correct for what each surface
 * has on hand.
 *
 * `members.email` is `citext`, so every comparison in TypeScript lowercases
 * first — otherwise a file saying `Joao@x.test` would resolve in Postgres and
 * miss in the browser.
 */

export interface Person {
  memberId: string;
  email: string;
  displayName: string | null;
}

/** Trimmed and lowercased, or null when there is nothing there. */
export function normaliseEmail(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/** How a person is written on screen: their name, or their email when they have none. */
export function personLabel(person: Person): string {
  return person.displayName?.trim() || person.email;
}

/** The roster entry for an email, case-insensitively. Null when nobody matches. */
export function findPerson(
  people: readonly Person[],
  email: string | null | undefined,
): Person | null {
  const wanted = normaliseEmail(email);
  if (!wanted) return null;
  return people.find((p) => p.email.toLowerCase() === wanted) ?? null;
}
