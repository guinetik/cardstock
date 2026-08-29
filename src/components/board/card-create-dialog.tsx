"use client";

import dynamic from "next/dynamic";
import { type FormEvent, useState } from "react";
import type {
  CreateCardInput,
  CreateCardResult,
} from "@/app/p/[project]/b/[board]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CardColor } from "@/lib/card-color";
import { CARD_STATUSES, type CardStatus } from "@/lib/card-status";
import type { Epic, Lane, TagGroup } from "@/lib/types";
import { markHue } from "@/lib/types";
import { CardColorPicker } from "./card-color-picker";

const IssueBodyEditor = dynamic(
  () => import("@/app/p/[project]/b/[board]/c/[externalId]/issue-body-editor"),
  { ssr: false },
);

const label =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]";
const field =
  "h-8 w-full rounded-[var(--radius-input)] border border-[var(--border-input)] bg-[var(--surface-input)] px-2.5 text-sm text-[var(--color-ink)]";

/** Friendly create-dialog labels; option `value`s stay the raw `CARD_STATUSES` words. */
const STATUS_CREATE_LABEL: Record<CardStatus, string> = {
  backlog: "Backlog",
  blocked: "Blocked",
  wip: "In progress",
  held: "Held",
  built: "Built",
  handed: "Handed over",
  shipped: "Shipped",
  done: "Done",
};

export function CardCreateDialog(props: {
  lane: Lane | null;
  boardId: string;
  groups: TagGroup[];
  epics: Pick<Epic, "id" | "source_name" | "outcome">[];
  onClose: () => void;
  onCreate: (input: CreateCardInput) => Promise<CreateCardResult>;
}) {
  return (
    <Dialog
      open={props.lane !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      {props.lane && (
        <CardCreateForm key={props.lane.id} {...props} lane={props.lane} />
      )}
    </Dialog>
  );
}

function CardCreateForm(
  props: Omit<Parameters<typeof CardCreateDialog>[0], "lane"> & {
    lane: Lane;
  },
) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [status, setStatus] = useState("backlog");
  const [epicId, setEpicId] = useState("");
  const [area, setArea] = useState("");
  const [priority, setPriority] = useState("");
  const [effort, setEffort] = useState("");
  const [audience, setAudience] = useState<"all" | "internal">("all");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [tagIds, setTagIds] = useState<Set<string>>(() => new Set());
  const [color, setColor] = useState<CardColor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(id: string) {
    setTagIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await props.onCreate({
      boardId: props.boardId,
      laneId: props.lane.id,
      title,
      summary,
      bodyMarkdown,
      status,
      epicId: epicId || null,
      area,
      priority: priority ? (Number(priority) as 1 | 2 | 3) : null,
      effort: (effort || null) as "L" | "M" | "H" | null,
      audience,
      plannedStartDate,
      targetDate,
      targetLabel,
      tagIds: [...tagIds],
      color,
    });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else props.onClose();
  }

  const selectedEpic = props.epics.find((item) => item.id === epicId);

  return (
    <DialogContent className="card-create-sheet max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
      <form onSubmit={submit} className="contents">
        <DialogHeader className="card-create-masthead">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-grey)]">
            <span>New card</span>
            <span aria-hidden="true">/</span>
            <span className="card-create-lane-tab">{props.lane.name}</span>
          </div>
          <DialogTitle className="text-xl">Write the issue</DialogTitle>
          <DialogDescription>
            It will be filed first in {props.lane.name} and kept ready for the
            Markdown pull.
          </DialogDescription>
        </DialogHeader>

        <div className="card-create-main grid lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="card-create-writing grid gap-5 p-5 sm:p-6">
            <label htmlFor="new-card-title">
              <span className={label}>Issue title</span>
              <input
                id="new-card-title"
                className="card-create-title"
                required
                maxLength={240}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What needs to happen?"
                disabled={busy}
              />
            </label>
            <label className="card-create-note" htmlFor="new-card-summary">
              <span className={label}>Summary — in plain words</span>
              <textarea
                id="new-card-summary"
                className="min-h-16 w-full resize-y bg-transparent text-sm leading-6 outline-none placeholder:text-[var(--color-grey-faint)]"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="A short explanation for someone scanning the board"
                disabled={busy}
              />
            </label>
            <div className="card-create-description">
              <span className={label}>Description</span>
              <IssueBodyEditor markdown="" onChange={setBodyMarkdown} />
            </div>
          </div>

          <aside className="card-create-sidebar grid content-start gap-4 p-5">
            <p className="border-b border-[var(--border-strong)] pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-grey)]">
              Filing notes
            </p>
            <label htmlFor="new-card-status">
              <span className={label}>Status</span>
              <select
                id="new-card-status"
                className={field}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                disabled={busy}
              >
                {CARD_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_CREATE_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="new-card-epic">
              <span className={label}>Epic</span>
              <select
                id="new-card-epic"
                className={field}
                value={epicId}
                onChange={(event) => setEpicId(event.target.value)}
                disabled={busy}
              >
                <option value="">Unassigned</option>
                {props.epics.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.source_name}
                  </option>
                ))}
              </select>
              {selectedEpic?.outcome && (
                <span className="mt-1.5 block text-[11px] leading-4 text-[var(--color-grey)]">
                  {selectedEpic.outcome}
                </span>
              )}
            </label>
            <label htmlFor="new-card-area">
              <span className={label}>Area</span>
              <Input
                id="new-card-area"
                value={area}
                onChange={(event) => setArea(event.target.value)}
                placeholder="general"
                disabled={busy}
              />
            </label>
            <label htmlFor="new-card-audience">
              <span className={label}>Audience</span>
              <select
                id="new-card-audience"
                className={field}
                value={audience}
                onChange={(event) =>
                  setAudience(event.target.value as "all" | "internal")
                }
                disabled={busy}
              >
                <option value="all">Everyone</option>
                <option value="internal">Internal only</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label htmlFor="new-card-priority">
                <span className={label}>Priority</span>
                <select
                  id="new-card-priority"
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
              <label htmlFor="new-card-effort">
                <span className={label}>Effort</span>
                <select
                  id="new-card-effort"
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
            <label htmlFor="new-card-start">
              <span className={label}>Planned start</span>
              <Input
                id="new-card-start"
                type="date"
                value={plannedStartDate}
                onChange={(event) => setPlannedStartDate(event.target.value)}
                disabled={busy}
              />
            </label>
            <label htmlFor="new-card-target">
              <span className={label}>Target</span>
              <Input
                id="new-card-target"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                disabled={busy || !!targetLabel}
              />
            </label>
            <label htmlFor="new-card-target-label">
              <span className={label}>Rough date</span>
              <Input
                id="new-card-target-label"
                value={targetLabel}
                onChange={(event) => setTargetLabel(event.target.value)}
                placeholder="after new hire"
                disabled={busy || !!targetDate}
              />
            </label>
            <div>
              <span className={label}>Color</span>
              <CardColorPicker
                value={color}
                onChange={setColor}
                disabled={busy}
                label="New card color"
              />
            </div>
          </aside>
        </div>

        {!!props.groups.length && (
          <div className="card-create-tags space-y-2 px-5 py-4 sm:px-6">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-grey)]">
              Mark the card
            </p>
            <div className="space-y-2">
              {props.groups.map((group, index) => (
                <div
                  key={group.id}
                  className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3"
                >
                  <span className={label}>{group.name}</span>
                  <div className="flex flex-wrap gap-x-1.5 gap-y-1">
                    {group.tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={tagIds.has(tag.id)}
                        onClick={() => toggleTag(tag.id)}
                        disabled={busy}
                        className={`mark mark--${markHue(index)} ${tagIds.has(tag.id) ? "" : "mark--off"}`}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p
            className="mx-5 my-3 border-l-2 border-[var(--pen-red)] px-3 py-2 text-sm text-destructive sm:mx-6"
            role="alert"
          >
            {error}
          </p>
        )}
        <DialogFooter className="m-0 rounded-none border-[var(--border-divider)] bg-[var(--surface-panel)]">
          <Button type="submit" disabled={busy || !title.trim()}>
            {busy ? "Creating…" : `Create in ${props.lane.name}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={props.onClose}
          >
            Cancel
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
