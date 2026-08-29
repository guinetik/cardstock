"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState, useTransition } from "react";
import {
  applyProjectImport,
  type ImportApplyResult,
  type ImportPlanResult,
  planProjectImport,
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
import { Input } from "@/components/ui/input";
import { keyFromName } from "@/lib/keys";

/** A binder from a folder of sheets: name it, name its first board, drop the zip, read the plan, create. */
/** `contract` is `<SheetContract />` rendered by the server page, so the schema never reaches the client bundle. */
export function ImportProjectDialog({
  contract,
}: {
  contract: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [boardName, setBoardName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [planned, setPlanned] = useState<ImportPlanResult | null>(null);
  const [done, setDone] = useState<ImportApplyResult | null>(null);
  const [pending, start] = useTransition();

  const form = (f: File) => {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("boardName", boardName);
    fd.set("file", f);
    return fd;
  };
  const reset = () => {
    setFile(null);
    setPlanned(null);
    setDone(null);
  };
  const choose = (f: File | null) => {
    if (!f) return;
    setFile(f);
    start(async () => setPlanned(await planProjectImport(form(f))));
  };
  const create = () => {
    if (!file) return;
    start(async () => {
      const r = await applyProjectImport(form(file));
      setDone(r);
      if ("ok" in r) router.push(r.href);
    });
  };
  const plan = planned && "plan" in planned ? planned.plan : null;
  const ready = !!name.trim() && !!boardName.trim();

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
          <Button variant="outline" size="sm">
            Import project
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import a project</DialogTitle>
          <DialogDescription>
            A folder of sheets becomes a binder: its lanes and tag groups come
            from what the sheets say.
          </DialogDescription>
        </DialogHeader>
        {plan ? (
          <>
            <p className="font-mono text-[11px] text-[var(--color-grey)]">
              /p/{keyFromName(name)}/b/{keyFromName(boardName)}
            </p>
            <ImportPlanTable plan={plan} />
            {done && "error" in done && (
              <p className="text-sm text-[var(--pen-red)]" role="alert">
                {done.error}
                {done.href
                  ? ` The project exists and is empty: ${done.href}`
                  : ""}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Back
              </Button>
              <Button size="sm" disabled={pending || !plan.ok} onClick={create}>
                {pending
                  ? "Creating…"
                  : `Create project and import ${plan.counts.new} cards`}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label
                htmlFor="import-project-name"
                className="block space-y-1.5 text-sm"
              >
                <span className="font-medium">Name</span>
                <Input
                  id="import-project-name"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What the team calls it"
                />
              </label>
              <label
                htmlFor="import-board-name"
                className="block space-y-1.5 text-sm"
              >
                <span className="font-medium">First board</span>
                <Input
                  id="import-board-name"
                  required
                  maxLength={80}
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                  placeholder="Backlog"
                />
              </label>
            </div>
            <div className="import-drop">
              <label
                className={`dropzone${ready ? "" : " opacity-50"}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (ready) choose(e.dataTransfer.files[0] ?? null);
                }}
              >
                <span>
                  {!ready
                    ? "Name the project and its first board, then drop the zip."
                    : pending
                      ? "Reading the sheets…"
                      : "Drop a zip of the tracker here — one <n>.md per card — or choose one."}
                </span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  aria-label="Zip of sheets"
                  className="sr-only"
                  disabled={!ready}
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
