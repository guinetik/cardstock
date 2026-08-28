"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  type EpicPatch,
  updateEpic,
} from "@/app/p/[project]/b/[board]/cockpit/actions";
import type { Epic } from "@/lib/types";

const label =
  "mb-1 block text-[9px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]";
const field = "paper-field h-8 w-full";

export function EpicEditor({ epic }: { epic: Epic }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  function submit(form: FormData) {
    const priority = String(form.get("priority") ?? "");
    const patch: EpicPatch = {
      outcome: String(form.get("outcome") ?? ""),
      owner_label: String(form.get("owner") ?? ""),
      start_date: String(form.get("start") ?? ""),
      target_date: String(form.get("target") ?? ""),
      priority: priority ? (Number(priority) as 1 | 2 | 3) : null,
      confidence: String(
        form.get("confidence") ?? "unknown",
      ) as Epic["confidence"],
    };
    start(async () => {
      const result = await updateEpic(epic.id, patch);
      setMessage(result.ok ? "Commitment saved." : result.error);
      if (result.ok) router.refresh();
    });
  }
  return (
    <form
      action={submit}
      className="cockpit-instrument grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <label className="sm:col-span-2 lg:col-span-3">
        <span className={label}>Outcome — in plain words</span>
        <input
          name="outcome"
          className={field}
          defaultValue={epic.outcome ?? ""}
          placeholder="What becomes possible when this lands?"
        />
      </label>
      <label className="lg:col-span-2">
        <span className={label}>Owner</span>
        <input
          name="owner"
          className={field}
          defaultValue={epic.owner_label ?? ""}
          placeholder="Accountable lead"
        />
      </label>
      <label>
        <span className={label}>Priority</span>
        <select
          name="priority"
          className={field}
          defaultValue={epic.priority ?? ""}
        >
          <option value="">—</option>
          <option value="1">First</option>
          <option value="2">Next</option>
          <option value="3">Later</option>
        </select>
      </label>
      <label>
        <span className={label}>Planned start</span>
        <input
          type="date"
          name="start"
          className={`${field} font-mono`}
          defaultValue={epic.start_date ?? ""}
        />
      </label>
      <label>
        <span className={label}>Committed date</span>
        <input
          type="date"
          name="target"
          className={`${field} font-mono`}
          defaultValue={epic.target_date ?? ""}
        />
      </label>
      <label>
        <span className={label}>Owner view</span>
        <select
          name="confidence"
          className={field}
          defaultValue={epic.confidence}
        >
          <option value="unknown">Not set</option>
          <option value="confident">Confident</option>
          <option value="concerned">Concerned</option>
        </select>
      </label>
      <div className="flex items-end gap-3 lg:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="h-8 border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 text-xs font-medium text-[var(--surface-card)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save commitment"}
        </button>
        {message && (
          <output className="pb-2 text-xs text-[var(--color-grey)]">
            {message}
          </output>
        )}
      </div>
    </form>
  );
}
