/**
 * Guards shared by every sign-in path.
 *
 * The allowlist (`public.members`) decides who gets a session; these helpers
 * only check that the credentials themselves are well formed.
 */

/** Lowercased, trimmed address — or null if it is not one. */
export function normalizeEmail(raw: string | undefined | null): string | null {
  const email = raw?.trim().toLowerCase();
  if (!email) return null;
  // Deliberately loose: Supabase does the real validation. This only rejects
  // input that obviously is not an address.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/**
 * Shortest password we accept when someone onboards.
 *
 * Supabase's own floor is 6 (`minimum_password_length`); we ask for more here
 * so the rule does not change if that setting is ever raised on one instance
 * and not the other.
 */
export const MIN_PASSWORD = 8;

/**
 * Why this password cannot be used, or null when it is fine.
 *
 * Returns a message rather than a boolean so the form has something to show,
 * and checks the confirmation here so both halves of the rule live together.
 */
export function passwordProblem(
  password: string | undefined | null,
  confirm: string | undefined | null,
): string | null {
  const pw = password ?? "";
  if (pw.length < MIN_PASSWORD)
    return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw !== (confirm ?? "")) return "The two passwords do not match.";
  return null;
}
