import { createHash } from "node:crypto";

/** Gravatar's current hash: SHA-256 of the trimmed, lowercased address. */
export function gravatarHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/**
 * Portrait URL for an allowlisted email. `identicon` so a missing Gravatar is
 * still a mark, not a grey silhouette, and the CSS square-crops it.
 */
export function gravatarUrl(email: string, size = 80, bust?: number): string {
  const url = `https://www.gravatar.com/avatar/${gravatarHash(email)}?s=${size}&d=identicon&r=g`;
  return bust ? `${url}&t=${bust}` : url;
}
