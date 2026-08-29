"use client";

import { Inbox, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  applyBoardImport,
  type ImportApplyResult,
  type ImportPlanResult,
  planBoardImport,
} from "@/app/import-actions";
import { ImportPlanTable } from "@/components/import-plan-table";
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
  contract,
}: {
  boardId: string;
  boardName: string;
  /**
   * The sheet contract, pre-rendered server-side by the caller (a server
   * component) so `jsonSchema()`/zod never ship to the client bundle — this
   * component is `"use client"` and would otherwise pull the whole schema in.
   */
  contract: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [planned, setPlanned] = useState<ImportPlanResult | null>(null);
  const [done, setDone] = useState<ImportApplyResult | null>(null);
  const [pending, start] = useTransition();
  /** Which plan request is the current one; an older answer is dropped. */
  const request = useRef(0);

  const reset = () => {
    request.current++;
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
  // A zip that never reaches the server throws out of the transition; the
  // dialog says so instead of sitting on "Reading the sheets…" forever.
  const TRANSPORT = {
    error: "The upload did not reach the server. Try a smaller zip.",
  };
  const choose = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setDone(null);
    // Two drops in a row: only the latest plan is allowed to land.
    const id = ++request.current;
    start(async () => {
      let r: ImportPlanResult;
      try {
        r = await planBoardImport(form(f));
      } catch {
        r = TRANSPORT;
      }
      if (id === request.current) setPlanned(r);
    });
  };
  const apply = () => {
    if (!file) return;
    start(async () => {
      try {
        setDone(await applyBoardImport(form(file)));
      } catch {
        setDone(TRANSPORT);
      }
    });
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
            className="binder-tool"
            aria-label={`Import into ${boardName}`}
            title={`Import into ${boardName}`}
          >
            <Upload size={14} aria-hidden="true" />
          </button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importing into {boardName}</DialogTitle>
          <DialogDescription>
            The sheet wins: whatever a file states replaces what the board has.
            If filing stops partway, what was filed stays — nothing is ever
            deleted. You see the plan before anything is filed.
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
              className="dropzone dropzone--drawer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                choose(e.dataTransfer.files[0] ?? null);
              }}
            >
              <Inbox size={20} aria-hidden="true" className="dropzone-icon" />
              <span className="dropzone-say">
                {pending
                  ? "Reading the sheets…"
                  : `Clip sheets into ${boardName}.`}
              </span>
              <span className="dropzone-alt">or choose a file</span>
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
            {contract}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
