import { LoginForm } from "@/app/(app)/login/login-form";

/**
 * The left rail: the wordmark, the way in, and what to do when the way in does
 * not work. It carries the real sign-in form, so a member who lands on the
 * pitch by accident is one field away from their board rather than one click
 * plus a page load.
 */
export function LandingRail() {
  return (
    <aside className="w-full flex-1 self-stretch border-b border-[var(--border-divider)] bg-[var(--surface-panel)] md:w-auto md:min-w-[296px] md:max-w-[412px] md:basis-[340px] md:border-b-0 md:border-r">
      {/*
       * A rail only from the breakpoint where there is room beside it. Stacked
       * on a phone it is a header, so it holds its own height: a full screen of
       * password box before the first sentence of the pitch is a page nobody
       * scrolls.
       */}
      <div className="flex flex-col justify-between gap-[22px] px-6 pb-[22px] pt-6 md:sticky md:top-0 md:min-h-screen">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-baseline gap-2">
            <span className="font-heading text-[20px] font-semibold text-[var(--color-ink)]">
              cardstock
            </span>
            <span className="border border-[var(--border-strong)] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]">
              beta
            </span>
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-[var(--color-grey-faint)]">
            v0.1
          </span>
        </div>

        <div className="paper-card paper-card--still px-[22px] pb-5 pt-[22px]">
          <h2 className="text-[22px]">Sign in</h2>
          <p className="mt-1.5 text-[13.5px] leading-snug text-[var(--color-grey)]">
            cardstock is invite-only while the beta is small enough to answer
            email personally. Sign in with the address you were invited with.
            Setting a password the first time is the whole of onboarding.
          </p>
          <div className="mt-5">
            <LoginForm next="/projects" />
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5 border-t border-[var(--border-divider)] pt-3.5">
            <a href="#invite" className="paper-link text-[13px]">
              No invite yet? Ask for one
            </a>
            <p className="font-mono text-[10.5px] leading-relaxed tracking-[0.04em] text-[var(--color-grey-faint)]">
              locked out? the owner resets passwords by hand for now
            </p>
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-2 border-t border-[var(--border-divider)] pt-3">
            <span className="stat stat--ink">invite only</span>
            <span className="stat stat--muted">gpl v3</span>
            <span className="stat stat--muted">self-hostable</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
