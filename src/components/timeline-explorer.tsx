"use client";

import { useMemo, useState } from "react";
import { TimelineRail, type TimelineRailItem } from "./timeline-rail";

type SignalFilter = TimelineRailItem["signal"] | "all";

/** Filters the raised-date rail by search, epic, diagnostic, gate, and date range. */
export function TimelineExplorer({
  items,
  today,
  watchDays,
  gates,
}: {
  items: TimelineRailItem[];
  today: string;
  watchDays: number;
  gates: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [epic, setEpic] = useState("all");
  const [signal, setSignal] = useState<SignalFilter>("all");
  const [gateFilter, setGateFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const epics = useMemo(
    () =>
      [
        ...new Set(
          items
            .map((item) => item.epicName)
            .filter((name): name is string => !!name),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const hasUnassigned = items.some((item) => !item.epicName);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (
        needle &&
        !`${item.externalId} ${item.title} ${item.epicName ?? ""}`
          .toLocaleLowerCase()
          .includes(needle)
      )
        return false;
      if (epic === "unassigned" && item.epicName) return false;
      if (epic !== "all" && epic !== "unassigned" && item.epicName !== epic)
        return false;
      if (signal !== "all" && item.signal !== signal) return false;
      if (gateFilter === "ungated" && item.gateId) return false;
      if (
        gateFilter !== "all" &&
        gateFilter !== "ungated" &&
        item.gateId !== gateFilter
      )
        return false;
      const raised = item.raisedOn.slice(0, 10);
      if (from && raised < from) return false;
      if (to && raised > to) return false;
      return true;
    });
  }, [epic, from, gateFilter, items, query, signal, to]);
  const filtering =
    !!query ||
    epic !== "all" ||
    signal !== "all" ||
    gateFilter !== "all" ||
    !!from ||
    !!to;

  function clear() {
    setQuery("");
    setEpic("all");
    setSignal("all");
    setGateFilter("all");
    setFrom("");
    setTo("");
  }

  return (
    <>
      <fieldset className="mb-4 flex flex-wrap items-end gap-3 border-y border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-3">
        <legend className="sr-only">Timeline filters</legend>
        <label className="min-w-44 flex-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
          Find
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, #id, or epic"
            className="paper-field mt-1 block h-8 w-full text-xs normal-case tracking-normal"
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
          Epic
          <select
            value={epic}
            onChange={(event) => setEpic(event.target.value)}
            className="paper-field mt-1 block h-8 min-w-36 max-w-56 px-2 text-xs normal-case tracking-normal"
          >
            <option value="all">All epics</option>
            {hasUnassigned && <option value="unassigned">Unassigned</option>}
            {epics.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
          State
          <select
            value={signal}
            onChange={(event) => setSignal(event.target.value as SignalFilter)}
            className="paper-field mt-1 block h-8 min-w-28 px-2 text-xs normal-case tracking-normal"
          >
            <option value="all">Any state</option>
            <option value="active">Open</option>
            <option value="planned">Planned</option>
            <option value="forgotten">Forgotten</option>
            <option value="overdue">Overdue</option>
            <option value="delivered">Delivered</option>
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
          Gate
          <select
            value={gateFilter}
            onChange={(event) => setGateFilter(event.target.value)}
            className="paper-field mt-1 block h-8 min-w-36 max-w-56 px-2 text-xs normal-case tracking-normal"
          >
            <option value="all">Any gate</option>
            <option value="ungated">Ungated</option>
            {gates.map((gate) => (
              <option key={gate.id} value={gate.id}>
                {gate.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
          Raised from
          <input
            type="date"
            value={from}
            max={to || today}
            onChange={(event) => setFrom(event.target.value)}
            className="paper-field mt-1 block h-8 px-2 text-xs normal-case tracking-normal"
          />
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-grey)]">
          Raised to
          <input
            type="date"
            value={to}
            min={from || undefined}
            max={today}
            onChange={(event) => setTo(event.target.value)}
            className="paper-field mt-1 block h-8 px-2 text-xs normal-case tracking-normal"
          />
        </label>
        {filtering && (
          <button
            type="button"
            onClick={clear}
            className="paper-link mb-1 text-xs"
          >
            Clear filters
          </button>
        )}
      </fieldset>

      <div
        className="mb-2 flex justify-end font-mono text-[10px] text-[var(--color-grey)]"
        aria-live="polite"
      >
        {filtering
          ? `${filtered.length} of ${items.length} raised`
          : `${items.length} raised`}
      </div>
      {filtered.length ? (
        <TimelineRail items={filtered} today={today} watchDays={watchDays} />
      ) : (
        <div className="border-y border-[var(--border-hairline)] py-8 text-center">
          <p className="text-sm">No raised work matches these filters.</p>
          <button
            type="button"
            onClick={clear}
            className="paper-link mt-2 text-xs"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
