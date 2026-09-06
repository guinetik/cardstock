"use server";
import { normalizeEmail } from "@/lib/auth";
import { ownerAddress, sendMail } from "@/lib/mail";

export type InviteResult = { ok?: true; error?: string };

/** Longest each free-text answer may be. The mail endpoint accepts far more;
 *  this is about what a person can be asked to read, not what fits. */
const MAX_TEAM = 120;
const MAX_NOTE = 1200;

/** Shown for a send that failed on our side. The visitor did nothing wrong and
 *  cannot fix it, so the text points at the only route that still works. */
const SEND_FAILED =
  "That request did not go through. Email the address in the footer and it will reach the same place.";

function clean(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** One line of the mail body, or nothing when the field was left empty. */
function row(label: string, value: string): string {
  return value
    ? `<p><strong>${label}</strong><br>${escapeHtml(value)}</p>`
    : "";
}

/**
 * Ask for an invite. The form on the landing page has no account behind it and
 * writes no row: it puts the request in the owner's inbox, which is where the
 * decision gets made anyway.
 */
export async function requestInvite(
  _prev: InviteResult | null,
  form: FormData,
): Promise<InviteResult> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  if (!email) return { error: "Enter a valid email address." };
  const team = clean(form.get("team"), MAX_TEAM);
  const note = clean(form.get("note"), MAX_NOTE);

  const owner = ownerAddress();
  if (!owner) return { error: SEND_FAILED };

  const result = await sendMail({
    to: [owner],
    subject: `cardstock invite request: ${email}`,
    html: [
      "<h2>Invite request</h2>",
      row("Email", email),
      row("Team", team),
      row("What they would file", note),
    ]
      .filter(Boolean)
      .join("\n"),
    text: [
      "Invite request",
      `Email: ${email}`,
      team && `Team: ${team}`,
      note && `What they would file: ${note}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
  if (!result.ok) return { error: SEND_FAILED };
  return { ok: true };
}
