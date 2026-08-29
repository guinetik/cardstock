"use client";
import { useEffect, useRef, useState } from "react";
import { statusChipClass } from "@/lib/card-status";
import type { Filters, InboxSort } from "@/lib/filters";
import { EFFORT_LABEL, markHue, type TagGroup } from "@/lib/types";

const PEN = { 1: "sq--red", 2: "sq--blue", 3: "sq--violet" } as const;
const EFF = { L: "sq--green", M: "sq--amber", H: "sq--red" } as const;

function Caret() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 4.5 6 8 9.5 4.5" />
    </svg>
  );
}

/**
 * Board filters, laid out as a printed form: every cluster is a fieldset with
 * a legend, so P1–P3, L/M/H, and tracker statuses never appear as bare abbreviations.
 * Only the search field stands on its own, because a search box explains itself.
 * Status is a single-select menu of this board's values; Clear sets it to null
 * without resetting Internal.
 */
export function FilterBar(props: {
  groups: TagGroup[];
  statuses: string[];
  filters: Filters;
  onChange: (f: Filters) => void;
  filtering: boolean;
  inboxSort: InboxSort;
  onInboxSort: (s: InboxSort) => void;
  onShowInternal: (v: boolean) => void;
}) {
  const { filters: f, onChange } = props;
  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    return n;
  };
  const check =
    "flex cursor-pointer items-center gap-1.5 text-[12.5px] text-[var(--color-ink2)]";

  // <details> has no click-away of its own. Listen only while one is open,
  // and on `click` rather than `pointerdown` — a pointerdown listener that
  // lives all the time swallows other menus' own open gesture.
  const barRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const closeAll = () => {
      barRef.current?.querySelectorAll("details[open]").forEach((d) => {
        d.removeAttribute("open");
      });
      setMenuOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const open = barRef.current?.querySelectorAll("details[open]");
      if ([...(open ?? [])].some((d) => d.contains(e.target as Node))) return;
      closeAll();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  /** Close the wrapping <details> after a menu pick. */
  const closeMenu = (el: HTMLElement) => {
    el.closest("details")?.removeAttribute("open");
    setMenuOpen(false);
  };

  return (
    <div
      id="filters"
      ref={barRef}
      className="paper-topbar sticky top-0 z-10 flex flex-wrap items-stretch gap-x-3 gap-y-3 border-t border-[var(--border-hairline)] px-4 py-3 sm:px-6"
    >
      <input
        type="search"
        placeholder="Search #id or title"
        className="paper-field h-auto min-w-56 flex-1 basis-72 text-[13.5px] sm:max-w-96"
        value={f.query}
        onChange={(e) => onChange({ ...f, query: e.target.value })}
        aria-label="Search"
        id="search"
      />

      {props.groups.length > 0 && (
        <fieldset className="fieldset relative">
          <legend>Tags</legend>
          {props.groups.map((g, i) => {
            const hue = markHue(i);
            const on = [...g.tags].filter((t) => f.tags.has(t.id)).length;
            return (
              <details
                key={g.id}
                name="filter-menu"
                data-key={g.key}
                onToggle={(e) => {
                  if (e.currentTarget.open) setMenuOpen(true);
                }}
              >
                <summary
                  className="flex cursor-pointer list-none items-center gap-1.5 pb-0.5 text-[13px]"
                  style={{
                    color: on ? "var(--color-ink)" : "var(--color-ink2)",
                    borderBottom: on
                      ? `2px solid var(--mark-${hue})`
                      : "2px solid transparent",
                  }}
                >
                  {g.name}
                  {on ? (
                    <span className="font-mono text-[11px]">{on}</span>
                  ) : null}
                  <Caret />
                </summary>
                <div className="absolute inset-x-0 top-full z-20 mt-2 flex max-h-72 flex-wrap gap-x-2 gap-y-1.5 overflow-auto rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-lift)]">
                  {g.tags.map((t) => {
                    const picked = f.tags.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={picked}
                        className={`mark mark--${hue} ${picked ? "" : "mark--off"}`}
                        onClick={() =>
                          onChange({ ...f, tags: toggle(f.tags, t.id) })
                        }
                      >
                        {t.name}
                      </button>
                    );
                  })}
                  {!g.tags.length && (
                    <p className="text-[12px] text-[var(--color-grey)]">
                      No tags yet
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </fieldset>
      )}

      <fieldset className="fieldset">
        <legend>Priority</legend>
        {([1, 2, 3] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={f.priority.has(p)}
            className={`sq ${f.priority.has(p) ? `sq--on ${PEN[p]}` : ""}`}
            title={`Priority ${p}`}
            onClick={() => onChange({ ...f, priority: toggle(f.priority, p) })}
          >
            P{p}
          </button>
        ))}
      </fieldset>

      <fieldset className="fieldset">
        <legend>Effort</legend>
        {(["L", "M", "H"] as const).map((e) => (
          <button
            key={e}
            type="button"
            aria-pressed={f.effort.has(e)}
            className={`sq ${f.effort.has(e) ? `sq--on ${EFF[e]}` : ""}`}
            title={EFFORT_LABEL[e]}
            onClick={() => onChange({ ...f, effort: toggle(f.effort, e) })}
          >
            {e}
          </button>
        ))}
      </fieldset>

      {props.statuses.length > 0 && (
        <fieldset className="fieldset relative">
          <legend>Status</legend>
          <details
            name="filter-menu"
            data-key="status"
            onToggle={(e) => {
              if (e.currentTarget.open) setMenuOpen(true);
            }}
          >
            <summary className="flex cursor-pointer list-none items-center gap-1.5 pb-0.5 text-[13px]">
              {f.status ? (
                <span className={statusChipClass(f.status)}>{f.status}</span>
              ) : (
                <span className="stat stat--muted">any</span>
              )}
              <Caret />
            </summary>
            <div className="absolute left-0 top-full z-20 mt-2 flex min-w-[7.5rem] flex-col gap-1.5 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-lift)]">
              <button
                type="button"
                aria-pressed={f.status === null}
                className="stat stat--muted text-left"
                onClick={(e) => {
                  onChange({ ...f, status: null });
                  closeMenu(e.currentTarget);
                }}
              >
                any
              </button>
              {props.statuses.map((status) => {
                const on = f.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={on}
                    className={`${statusChipClass(status)} text-left`}
                    onClick={(e) => {
                      onChange({
                        ...f,
                        status: on ? null : status,
                      });
                      closeMenu(e.currentTarget);
                    }}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </details>
        </fieldset>
      )}

      <fieldset className="fieldset gap-3">
        <legend>Also show</legend>
        <label className={check}>
          <input
            type="checkbox"
            className="accent-[var(--pen-blue)]"
            checked={f.showInternal}
            onChange={(e) => props.onShowInternal(e.target.checked)}
          />
          Internal
        </label>
        <label className={check}>
          <input
            type="checkbox"
            className="accent-[var(--pen-blue)]"
            checked={f.showArchived}
            onChange={(e) => onChange({ ...f, showArchived: e.target.checked })}
          />
          Archived
        </label>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Unsorted order</legend>
        <select
          className="paper-field h-7 px-1.5 text-[12.5px]"
          value={props.inboxSort}
          onChange={(e) => props.onInboxSort(e.target.value as InboxSort)}
          aria-label="Unsorted order"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="id-asc"># ascending</option>
          <option value="id-desc"># descending</option>
        </select>
      </fieldset>

      {props.filtering && (
        <button
          type="button"
          className="paper-link ml-auto self-center text-[12.5px]"
          onClick={() =>
            onChange({
              ...f,
              query: "",
              tags: new Set(),
              priority: new Set(),
              effort: new Set(),
              status: null,
              showArchived: false,
            })
          }
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
