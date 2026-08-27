/**
 * Guards shared by every sign-in path.
 *
 * The allowlist (`public.members`) decides who gets a session; these helpers
 * decide whether the *dev-only* path is allowed to run at all.
 */

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/**
 * True only for a Supabase running on this machine.
 *
 * Compares the parsed hostname rather than substring-matching the URL, so
 * `https://localhost.evil.example` cannot pass for local.
 */
export function isLocalSupabase(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** True when the dev sign-in button may be offered and honoured. */
export function isDevLoginEnabled(env: {
  NODE_ENV?: string;
  NEXT_PUBLIC_DEV_LOGIN?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
}): boolean {
  return (
    env.NODE_ENV !== "production" &&
    env.NEXT_PUBLIC_DEV_LOGIN === "1" &&
    isLocalSupabase(env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

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
