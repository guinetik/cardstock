"use client";

import { FilePenLine, Files } from "lucide-react";
import {
  type ComponentProps,
  useActionState,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from "react";
import { type ActivityKind, activity, trackActivity } from "@/lib/activity";

const idle = () => null;
const notSaving = () => false;

/** Link, form and router transitions register only while React reports pending. */
export function usePendingActivity(pending: boolean, kind: ActivityKind) {
  useEffect(() => {
    if (pending) return activity.begin(kind);
  }, [pending, kind]);
}

export function useSaving(subject: string) {
  return useSyncExternalStore(
    activity.subscribe,
    () => activity.saving(subject),
    notSaving,
  );
}

export function SavingRow({
  subject,
  ...props
}: ComponentProps<"tr"> & { subject: string }) {
  const saving = useSaving(subject);
  return (
    <tr
      {...props}
      data-saving={saving || undefined}
      aria-busy={saving || undefined}
    />
  );
}

export function useActivityActionState<State, Payload>(
  action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
  initialState: Awaited<State>,
  permalink?: string,
) {
  const tracked = useCallback(
    (state: Awaited<State>, payload: Payload) =>
      trackActivity("saving", async () => action(state, payload)),
    [action],
  );
  return useActionState(tracked, initialState, permalink);
}

/** A quiet paper tab. No success claim: the form owns validation and errors. */
export function ActivityIndicator() {
  const kind = useSyncExternalStore(
    activity.subscribe,
    activity.snapshot,
    idle,
  );
  const Icon = kind === "saving" ? FilePenLine : Files;
  return (
    <output
      className="app-activity"
      data-active={kind ? "true" : undefined}
      data-kind={kind ?? undefined}
      aria-live="polite"
      aria-atomic="true"
      data-testid="app-activity"
    >
      {kind && (
        <>
          <Icon size={15} aria-hidden="true" />
          <span>{kind === "saving" ? "Saving…" : "Loading…"}</span>
          <span className="app-activity-mark" aria-hidden="true" />
        </>
      )}
    </output>
  );
}
