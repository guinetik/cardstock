"use client";

import { useActionState, useState } from "react";
import { createProject } from "@/app/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { keyFromName } from "@/lib/keys";

/**
 * A new binder. The name is what goes on the cover; the key it produces is
 * the spine label and the URL, and it is shown as you type because, unlike
 * the name, it does not change afterwards.
 */
export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState(createProject, null);
  const slug = keyFromName(name);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">New project</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a project</DialogTitle>
          <DialogDescription>
            A project is a binder: boards are its tabs, cards are its sheets.
            People are added to it from the Users page.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <label htmlFor="project-name" className="block space-y-1.5 text-sm">
            <span className="font-medium">Name</span>
            <Input
              id="project-name"
              name="name"
              required
              maxLength={80}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What the team calls it"
            />
          </label>
          <p
            className="flex items-baseline gap-2 border-l-2 border-[var(--border-strong)] pl-3 font-mono text-[11px] text-[var(--color-grey)]"
            aria-live="polite"
          >
            <span className="uppercase tracking-[0.11em] text-[var(--color-grey-faint)]">
              filed as
            </span>
            <span className="text-[var(--color-ink)]">
              /p/
              {slug || (
                <span className="text-[var(--color-grey-faint)]">…</span>
              )}
            </span>
          </p>
          <label
            htmlFor="project-description"
            className="block space-y-1.5 text-sm"
          >
            <span className="font-medium">Description</span>
            <Textarea
              id="project-description"
              name="description"
              maxLength={500}
              rows={3}
              placeholder="One line on the cover: what this project is for."
            />
          </label>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
