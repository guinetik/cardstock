"use client";

import { useActionState } from "react";
import { updateTimelineSettings } from "./actions";

export function TimelineSettings({
  projectId,
  projectSlug,
  initialDays,
}: {
  projectId: string;
  projectSlug: string;
  initialDays: number;
}) {
  const [state, action, pending] = useActionState(updateTimelineSettings, null);

  return (
    <section className="cta" aria-labelledby="timeline-settings-heading">
      <div className="min-w-0">
        <h2 id="timeline-settings-heading" className="cta-title">
          Forgotten work window
        </h2>
        <p className="cta-body">
          The timeline marks active cards that were raised this long ago and
          still have no target date or rough date.
        </p>
      </div>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="projectSlug" value={projectSlug} />
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
          Days
          <input
            type="number"
            name="forgottenAfterDays"
            min="1"
            max="365"
            step="1"
            required
            defaultValue={initialDays}
            className="paper-field mt-1 block w-20 text-sm"
          />
        </label>
        <button type="submit" className="cta-button" disabled={pending}>
          {pending ? "Saving…" : "Save window"}
        </button>
      </form>
      <span
        className={`cta-note ${state?.error ? "text-[var(--pen-red)]" : ""}`}
        aria-live="polite"
      >
        {state?.error ?? state?.message ?? "Default · 14 days"}
      </span>
    </section>
  );
}
