/**
 * Display names people type, and the permanent keys markdown writes.
 *
 * Lanes and tags both work this way: the name is yours to change, the key is
 * what a card's frontmatter names the thing by, so it is fixed once created.
 */

/** Turn a display name into the permanent key written to card frontmatter. */
export function keyFromName(name: string): string {
  return name
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cleanName(name: string): string | null {
  const clean = name.trim().replace(/\s+/g, " ");
  return clean.length > 0 && clean.length <= 80 ? clean : null;
}

/** Why this display name cannot be stored, or null when it is fine. */
export function displayNameProblem(
  raw: string | undefined | null,
): string | null {
  if (!cleanName(raw ?? "")) return "Enter a name (80 characters or fewer).";
  return null;
}

/** The name we show. Never the email local-part. */
export function memberLabel(displayName: string | null | undefined): string {
  const name = displayName?.trim();
  return name ? name : "No name yet";
}
