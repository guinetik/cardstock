"use client";

import { useState } from "react";
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
 * Explains how a project gets imported today.
 *
 * Importing is a command-line job for now: a board's lanes and tag vocabulary
 * are decisions someone makes once, not something a zip can infer. This dialog
 * documents that path; dropping a zip will drive the same steps later.
 */

const STEPS: { title: string; body: string; code?: string }[] = [
  {
    title: "1. Describe the board",
    body: "Write a seed next to your tracker: the project, its board, the lanes in order with their kinds (inbox, work, waiting, built, done, archive), and the tag groups. Lane keys are permanent — card frontmatter stores them.",
    code: "your-tracker/\n  seed.sql        # project, board, lanes, tag groups, tags\n  mapping.json    # optional tag overrides\n  tracker/        # one .md per item",
  },
  {
    title: "2. Apply it",
    body: "Creates the project, board, lanes and tags. Safe to re-run — every statement is idempotent.",
    code: "bun run db:apply --file path/to/seed.sql",
  },
  {
    title: "3. Import the markdown",
    body: "Parses every .md, validates the frontmatter, and upserts by (board, external_id). Markdown owns the narrative; the board owns lane, rank, priority, effort and dates. Unchanged files are skipped.",
    code: "bun run etl:import --project <slug> --board <slug> \\\n  --source path/to/tracker",
  },
  {
    title: "4. Let people in",
    body: "The allowlist is separate from the import — a project with no members is invisible to everyone but the owner.",
    code: "bun run db:seed-members --project <slug>",
  },
];

export function ImportProjectDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Import project
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a project</DialogTitle>
          <DialogDescription>
            A project is a markdown tracker plus the board decisions layered on
            top. Today that import runs from the command line.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4">
          {STEPS.map((step) => (
            <li key={step.title} className="space-y-1.5">
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
              {step.code && (
                <pre className="overflow-x-auto rounded-md border bg-muted/50 p-2.5 text-xs">
                  <code>{step.code}</code>
                </pre>
              )}
            </li>
          ))}
        </ol>
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Coming later:</span>{" "}
          drop a zip of the markdown repo here and cardstock will infer the
          tracker, propose lanes and tag groups from what it finds, and run
          these steps for you.
        </p>
      </DialogContent>
    </Dialog>
  );
}
