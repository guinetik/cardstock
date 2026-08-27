"use client";
import type { Filters, InboxSort } from "@/lib/filters";
import type { TagGroup } from "@/lib/types";

export function FilterBar(props: {
  groups: TagGroup[];
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
  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-[var(--surface-input)] text-muted-foreground hover:text-foreground"}`;
  return (
    <div
      id="filters"
      className="glass-topbar sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6"
    >
      <input
        type="search"
        placeholder="Search #id or title"
        className="h-8 w-52 rounded-md border bg-background px-2 text-sm"
        value={f.query}
        onChange={(e) => onChange({ ...f, query: e.target.value })}
        aria-label="Search"
        id="search"
      />
      {props.groups.map((g) => (
        <details key={g.id} className="relative" data-key={g.key}>
          <summary
            className={`${chip([...g.tags].some((t) => f.tags.has(t.id)))} cursor-pointer list-none`}
          >
            {g.name}
            {[...g.tags].filter((t) => f.tags.has(t.id)).length
              ? ` ·${[...g.tags].filter((t) => f.tags.has(t.id)).length}`
              : ""}
          </summary>
          <div className="absolute left-0 z-20 mt-1 max-h-72 min-w-48 overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
            {g.tags.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={f.tags.has(t.id)}
                  onChange={() =>
                    onChange({ ...f, tags: toggle(f.tags, t.id) })
                  }
                />
                {t.name}
              </label>
            ))}
            {!g.tags.length && (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                No tags yet
              </p>
            )}
          </div>
        </details>
      ))}
      <span className="mx-1 h-5 border-l" />
      {([1, 2, 3] as const).map((p) => (
        <button
          key={p}
          type="button"
          className={chip(f.priority.has(p))}
          onClick={() => onChange({ ...f, priority: toggle(f.priority, p) })}
        >
          P{p}
        </button>
      ))}
      <span className="mx-1 h-5 border-l" />
      {(["L", "M", "H"] as const).map((e) => (
        <button
          key={e}
          type="button"
          className={chip(f.effort.has(e))}
          onClick={() => onChange({ ...f, effort: toggle(f.effort, e) })}
          title="Difficulty"
        >
          {e}
        </button>
      ))}
      <span className="mx-1 h-5 border-l" />
      <label className="flex items-center gap-1 text-xs">
        <input
          type="checkbox"
          checked={f.showInternal}
          onChange={(e) => props.onShowInternal(e.target.checked)}
        />
        internal
      </label>
      <label className="flex items-center gap-1 text-xs">
        <input
          type="checkbox"
          checked={f.showArchived}
          onChange={(e) => onChange({ ...f, showArchived: e.target.checked })}
        />
        archived
      </label>
      <label className="flex items-center gap-1 text-xs">
        Unsorted
        <select
          className="h-7 rounded-md border bg-background px-1 text-xs"
          value={props.inboxSort}
          onChange={(e) => props.onInboxSort(e.target.value as InboxSort)}
          aria-label="Inbox sort"
        >
          <option value="newest">newest first</option>
          <option value="oldest">oldest first</option>
        </select>
      </label>
      {props.filtering && (
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() =>
            onChange({
              ...f,
              query: "",
              tags: new Set(),
              priority: new Set(),
              effort: new Set(),
              showArchived: false,
            })
          }
        >
          Clear
        </button>
      )}
    </div>
  );
}
