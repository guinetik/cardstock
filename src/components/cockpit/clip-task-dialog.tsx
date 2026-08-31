"use client";

import { PaperclipIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCard } from "@/app/p/[project]/b/[board]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Epic, Lane } from "@/lib/types";

const label =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]";
const field =
  "h-8 w-full rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] px-2.5 text-sm text-[var(--color-ink)]";

/**
 * The planning clipper: a fast, deliberately small intake for tasks thought
 * up mid-session. Everything lands in the inbox lane, already pinned to the
 * epic being planned; the form leads with priority, effort and dates so the
 * epic's picture sharpens as it grows. Stays open between clips.
 */
export function ClipTaskDialog({
  boardId,
  lane,
  epic,
}: {
  boardId: string;
  lane: Lane;
  epic: Pick<Epic, "id" | "source_name">;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState("");
  const [effort, setEffort] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clipped, setClipped] = useState<
    { externalId: string; title: string }[]
  >([]);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await createCard({
      boardId,
      laneId: lane.id,
      title,
      summary,
      epicId: epic.id,
      priority: priority ? (Number(priority) as 1 | 2 | 3) : null,
      effort: (effort || null) as "L" | "M" | "H" | null,
      plannedStartDate,
      targetDate,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setClipped((list) => [
      { externalId: result.card.external_id, title: result.card.title },
      ...list,
    ]);
    setTitle("");
    setSummary("");
    setPriority("");
    setEffort("");
    setPlannedStartDate("");
    setTargetDate("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <PaperclipIcon aria-hidden="true" />
            Add a task
          </Button>
        }
      />
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="contents"
        >
          <DialogHeader>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-grey)]">
              <span>New task</span>
              <span aria-hidden="true">/</span>
              <span>{epic.source_name}</span>
            </div>
            <DialogTitle className="text-xl">Plan the work</DialogTitle>
            <DialogDescription>
              Filed in {lane.name} on this epic. Dates, effort and priority
              sharpen the picture as you plan — details can wait for the board.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <label htmlFor="clip-title">
              <span className={label}>Task title</span>
              <Input
                id="clip-title"
                required
                maxLength={240}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs to happen?"
                disabled={busy}
                autoFocus
              />
            </label>
            <label htmlFor="clip-summary">
              <span className={label}>One line for the board</span>
              <Input
                id="clip-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Optional"
                disabled={busy}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label htmlFor="clip-priority">
                <span className={label}>Priority</span>
                <select
                  id="clip-priority"
                  className={field}
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  disabled={busy}
                >
                  <option value="">—</option>
                  <option value="1">P1</option>
                  <option value="2">P2</option>
                  <option value="3">P3</option>
                </select>
              </label>
              <label htmlFor="clip-effort">
                <span className={label}>Effort</span>
                <select
                  id="clip-effort"
                  className={field}
                  value={effort}
                  onChange={(event) => setEffort(event.target.value)}
                  disabled={busy}
                >
                  <option value="">—</option>
                  <option value="L">Low</option>
                  <option value="M">Medium</option>
                  <option value="H">High</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label htmlFor="clip-start">
                <span className={label}>Planned start</span>
                <Input
                  id="clip-start"
                  type="date"
                  value={plannedStartDate}
                  onChange={(event) => setPlannedStartDate(event.target.value)}
                  disabled={busy}
                />
              </label>
              <label htmlFor="clip-target">
                <span className={label}>Target</span>
                <Input
                  id="clip-target"
                  type="date"
                  value={targetDate}
                  onChange={(event) => setTargetDate(event.target.value)}
                  disabled={busy}
                />
              </label>
            </div>
          </div>

          {error && (
            <p
              className="border-l-2 border-[var(--pen-red)] px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}

          {clipped.length > 0 && (
            <ul
              className="max-h-32 space-y-1 overflow-y-auto border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--color-grey)]"
              aria-label="Clipped this session"
            >
              {clipped.map((item) => (
                <li key={item.externalId}>
                  Added #{item.externalId} — {item.title}
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? "Adding…" : `Add to ${lane.name}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
