"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TIMELINE_WINDOW_OPTIONS } from "@/lib/timeline";

/**
 * The delivery-pulse window picker. The choice lives in the `window` query
 * param so the server re-renders the section and the URL stays shareable.
 */
export function TimelineWindowSelect({ value }: { value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pick(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set("window", next);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
      Window
      <select
        className="h-7 rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] px-1.5 font-sans text-xs font-normal normal-case tracking-normal text-[var(--color-ink)]"
        value={String(value)}
        onChange={(event) => pick(event.target.value)}
        aria-label="Delivery window"
      >
        {TIMELINE_WINDOW_OPTIONS.map((days) => (
          <option key={days} value={String(days)}>
            Last {days} days
          </option>
        ))}
      </select>
    </label>
  );
}
