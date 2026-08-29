"use client";

import { useState, useTransition } from "react";
import {
  applyBoardImport,
  type ImportApplyResult,
  type ImportPlanResult,
  planBoardImport,
} from "@/app/import-actions";
import { ImportPlanTable } from "@/components/import-plan-table";
import { SheetContract } from "@/components/sheet-contract";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Drop → plan → done. The file stays in state and is posted twice: once to
 * plan, once to apply, and the server plans again before it writes.
 */
export function BoardImportDialog({
  boardId,
  boardName,
}: {
  boardId: string;
  boardName: string;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [planned, setPlanned] = useState<ImportPlanResult | null>(null);
  const [done, setDone] = useState<ImportApplyResult | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setFile(null);
    setPlanned(null);
    setDone(null);
  };
  const form = (f: File) => {
    const fd = new FormData();
    fd.set("boardId", boardId);
    fd.set("file", f);
    return fd;
  };
  const choose = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setDone(null);
    start(async () => setPlanned(await planBoardImport(form(f))));
  };
  const apply = () => {
    if (file) start(async () => setDone(await applyBoardImport(form(file))));
  };
  const plan = planned && "plan" in planned ? planned.plan : null;
  const toImport = plan ? plan.counts.new + plan.counts.changed : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="binder-import paper-link"
            aria-label={`Import into ${boardName}`}
          >
            ↑
          </button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importing into {boardName}</DialogTitle>
          <DialogDescription>
            The sheet wins: whatever a file states replaces what the board has.
            Nothing is deleted. You see the plan before anything is filed.
          </DialogDescription>
        </DialogHeader>
        {done && "ok" in done ? (
          <p className="stat stat--success" data-testid="import-done">
            {done.created} new · {done.updated} changed — filed.
          </p>
        ) : plan ? (
          <>
            <ImportPlanTable plan={plan} />
            {done && "error" in done && (
              <p className="text-sm text-[var(--pen-red)]" role="alert">
                {done.error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={pending || !plan.ok || toImport === 0}
                onClick={apply}
              >
                {pending
                  ? "Filing…"
                  : `Import ${toImport} ${toImport === 1 ? "card" : "cards"}`}
              </Button>
            </div>
          </>
        ) : (
          <div className="import-drop">
            <label
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                choose(e.dataTransfer.files[0] ?? null);
              }}
            >
              <span>
                {pending
                  ? "Reading the sheets…"
                  : "Drop a zip of the tracker here — one <n>.md per card — or choose one."}
              </span>
              <input
                type="file"
                accept=".zip,application/zip"
                aria-label="Zip of sheets"
                className="sr-only"
                onChange={(e) => choose(e.target.files?.[0] ?? null)}
              />
            </label>
            {planned && "error" in planned && (
              <p className="text-sm text-[var(--pen-red)]" role="alert">
                {planned.error}
              </p>
            )}
            <SheetContract />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
