"use client";

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { setCardWatch } from "@/app/watch-actions";

/** Always visible, including on a resting card; pressing it never starts a drag. */
export function CardWatchButton({
  cardId,
  externalId,
  watching,
  onChange,
}: {
  cardId: string;
  externalId: string;
  watching: boolean;
  onChange?: (watching: boolean) => void;
}) {
  const [on, setOn] = useState(watching);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setOn(watching);
  }, [watching]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const next = !on;
    try {
      const result = await setCardWatch(cardId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOn(next);
      onChange?.(next);
    } catch {
      setError("Could not update your watch. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        className={`card-watch${on ? " card-watch--on" : ""}`}
        aria-label={`${on ? "Stop watching" : "Watch"} card #${externalId}`}
        aria-pressed={on}
        disabled={busy}
        title={on ? "Watching — click to stop" : "Watch this card"}
        onClick={() => void toggle()}
      >
        <Eye size={14} aria-hidden="true" />
      </button>
      {error && (
        <span
          role="alert"
          className="absolute right-0 top-full z-30 mt-1 w-48 border border-[var(--pen-red)] bg-[var(--surface-card)] p-2 text-xs text-[var(--color-ink)]"
        >
          {error}
        </span>
      )}
    </span>
  );
}
