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

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createProject, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">New project</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a project</DialogTitle>
          <DialogDescription>
            A project groups boards and the people who can work in them.
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
            />
          </label>
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
