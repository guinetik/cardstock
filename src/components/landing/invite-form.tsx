"use client";
import { useActionState } from "react";
import { type InviteResult, requestInvite } from "@/app/invite-actions";

/**
 * Ask for an invite. Two shapes of the same request: the short one beside the
 * mid-page pitch, where an address is all anyone will type, and the long one
 * at the foot of the page, where someone who read this far has something to
 * say about their own backlog.
 */

export function InviteFormShort() {
  const [state, submit, sending] = useActionState<
    InviteResult | null,
    FormData
  >(requestInvite, null);
  if (state?.ok) return <Filed short />;
  return (
    <form
      action={submit}
      className="flex flex-1 basis-[260px] flex-wrap items-center gap-2"
      data-testid="invite-form-short"
    >
      <input
        className="paper-field h-9 flex-1 basis-[170px] text-[13.5px]"
        type="email"
        name="email"
        required
        placeholder="you@company.com"
        aria-label="Email for an invite"
      />
      <button
        type="submit"
        className="paper-btn h-9 px-4 py-0 text-[13px]"
        disabled={sending}
      >
        {sending ? "Sending" : "Ask for an invite"}
      </button>
      {state?.error && (
        <p className="basis-full text-[12.5px] text-[var(--pen-red)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function InviteFormFull() {
  const [state, submit, sending] = useActionState<
    InviteResult | null,
    FormData
  >(requestInvite, null);
  if (state?.ok) return <Filed />;
  return (
    <form
      action={submit}
      className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-start gap-3.5"
      data-testid="invite-form-full"
    >
      <label className="flex flex-col gap-1.5">
        <span className="field-label">Work email</span>
        <input
          className="paper-field h-9 text-[13.5px]"
          type="email"
          name="email"
          required
          placeholder="you@company.com"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="field-label">Team</span>
        <input
          className="paper-field h-9 text-[13.5px]"
          type="text"
          name="team"
          maxLength={120}
          placeholder="four of us, one board"
        />
      </label>
      <label className="col-span-full flex flex-col gap-1.5">
        <span className="field-label">What you would file first</span>
        <textarea
          className="paper-field h-auto resize-y p-2 text-[13.5px] leading-normal"
          name="note"
          rows={3}
          maxLength={1200}
          placeholder="a client backlog we keep in a spreadsheet nobody opens"
        />
      </label>
      <div className="col-span-full flex flex-wrap items-center gap-3.5">
        <button type="submit" className="paper-btn" disabled={sending}>
          {sending ? "Sending" : "Ask for an invite"}
        </button>
        <span className="font-mono text-[10.5px] tracking-[0.05em] text-[var(--color-grey-faint)]">
          one address, one email to the owner, no list
        </span>
      </div>
      {state?.error && (
        <p className="col-span-full text-[13px] text-[var(--pen-red)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** What replaces the form once the request is away. */
function Filed({ short = false }: { short?: boolean }) {
  if (short) {
    return (
      <p
        className="flex-1 basis-[260px] font-mono text-[11.5px] leading-relaxed tracking-[0.03em] text-[var(--pen-green)]"
        data-testid="invite-filed"
      >
        filed · the owner reads these
      </p>
    );
  }
  return (
    <div
      className="mt-6 flex flex-col gap-2 border-t border-dashed border-[var(--border-strong)] pt-4"
      data-testid="invite-filed"
    >
      <span className="stat stat--success">filed</span>
      <p className="text-[14px] leading-normal text-[var(--color-ink2)]">
        That is in the owner&rsquo;s inbox. If it is a fit, an invite arrives at
        the same address with a link to set a password.
      </p>
      <p className="font-mono text-[11.5px] text-[var(--color-grey)]">
        usually within a week
      </p>
    </div>
  );
}
