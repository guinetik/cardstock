"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveCardChecklist } from "@/app/(app)/p/[project]/b/[board]/actions";
import { useActivityRouter } from "@/components/activity-router";
import { useCardDraft, useCardSaves } from "@/components/card-save-scope";
import { trackActivity } from "@/lib/activity";
import type { CardChecklistItem } from "@/lib/types";

type Item = { id?: string; label: string; completed: boolean };
const inputClass =
  "min-w-0 flex-1 rounded border border-[var(--border-input)] bg-[var(--surface-input)] px-2 py-1 text-sm";

export function CardChecklist({
  cardId,
  items,
  revision,
}: {
  cardId: string;
  items: CardChecklistItem[];
  revision: number;
}) {
  const router = useActivityRouter();
  const saves = useCardSaves();
  const [draft, setDraft] = useState<Item[]>(items);
  const [baseRevision, setBaseRevision] = useState(revision);
  const [dirty, setDirty] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dragging = useRef<number | null>(null);
  useEffect(() => {
    if (!dirty && !pending && revision >= baseRevision) {
      setDraft(items);
      setBaseRevision(revision);
    }
  }, [items, revision, dirty, pending, baseRevision]);
  useCardDraft(
    "checklist",
    dirty || newLabel.trim()
      ? "Save or cancel your checklist edits before downloading."
      : null,
  );

  function save(next: Item[]) {
    setDraft(next);
    setDirty(true);
    setError(null);
    start(async () => {
      try {
        const result = await saves.run("checklist", () =>
          trackActivity(
            "saving",
            () => saveCardChecklist(cardId, baseRevision, next),
            cardId,
          ),
        );
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setDraft(result.items);
        setBaseRevision(result.revision);
        setDirty(false);
        saves.draft("checklist", null);
        router.refresh();
      } catch {
        setError("Could not save the checklist. Try again.");
      }
    });
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= draft.length) return;
    const next = [...draft];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    save(next);
  }

  return (
    <section
      className="mt-6 border-t border-[var(--color-grey-faint)] pt-4"
      aria-label="Checklist"
      aria-busy={pending}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Checklist</h2>
        <span className="text-xs text-[var(--color-grey)]" aria-live="polite">
          {draft.filter((i) => i.completed).length}/{draft.length} completed
        </span>
      </div>
      <ol className="space-y-2">
        {draft.map((item, index) => (
          <li
            key={item.id ?? `new-${index}`}
            className="flex items-center gap-2"
            draggable={!pending}
            onDragStart={() => {
              dragging.current = index;
            }}
            onDragEnd={() => {
              dragging.current = null;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!pending && dragging.current !== null)
                move(dragging.current, index);
              dragging.current = null;
            }}
          >
            <input
              type="checkbox"
              checked={item.completed}
              disabled={pending}
              aria-label={`Complete ${item.label}`}
              onChange={(e) =>
                save(
                  draft.map((i, n) =>
                    n === index ? { ...i, completed: e.target.checked } : i,
                  ),
                )
              }
            />
            <input
              className={`${inputClass} ${item.completed ? "text-[var(--color-grey)] line-through focus:no-underline" : ""}`}
              value={item.label}
              disabled={pending}
              aria-label={`Checklist item ${index + 1}`}
              onChange={(e) => {
                setDraft(
                  draft.map((i, n) =>
                    n === index ? { ...i, label: e.target.value } : i,
                  ),
                );
                setDirty(true);
              }}
              onBlur={() => {
                if (dirty && !pending)
                  save(draft.map((i) => ({ ...i, label: i.label.trim() })));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
            <button
              type="button"
              className="paper-link px-1"
              disabled={pending || index === 0}
              aria-label={`Move checklist item ${index + 1} up`}
              onClick={() => move(index, index - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="paper-link px-1"
              disabled={pending || index === draft.length - 1}
              aria-label={`Move checklist item ${index + 1} down`}
              onClick={() => move(index, index + 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="paper-link text-xs"
              disabled={pending}
              aria-label={`Delete checklist item ${index + 1}`}
              onClick={() => save(draft.filter((_, n) => n !== index))}
            >
              Delete
            </button>
          </li>
        ))}
      </ol>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newLabel.trim()) {
            save([...draft, { label: newLabel.trim(), completed: false }]);
            setNewLabel("");
          }
        }}
      >
        <input
          className={inputClass}
          aria-label="New checklist item"
          placeholder="Add a checklist item"
          value={newLabel}
          disabled={pending}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <button
          type="submit"
          className="paper-link text-sm"
          disabled={pending || !newLabel.trim()}
        >
          Add
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {dirty && !pending && (
        <div className="mt-2 flex gap-3 text-sm">
          <button
            type="button"
            className="paper-link"
            onClick={() => save(draft)}
          >
            Retry save
          </button>
          <button
            type="button"
            className="paper-link"
            onClick={() => {
              setDirty(false);
              setError(null);
              saves.clear("checklist");
              router.refresh();
            }}
          >
            Discard edits and reload
          </button>
        </div>
      )}
    </section>
  );
}
