"use client";

import { useActionState, useState } from "react";
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
import { createBoard } from "./actions";

export function CreateBoardDialog({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createBoard, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">New board</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a board</DialogTitle>
          <DialogDescription>
            A board is one collection of numbered markdown cards. It has its own
            lanes and tags.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="projectSlug" value={projectSlug} />
          <label htmlFor="board-name" className="block space-y-1.5 text-sm">
            <span className="font-medium">Name</span>
            <Input
              id="board-name"
              name="name"
              required
              maxLength={80}
              autoFocus
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Starts with Unsorted, Now, Next, Done, and Archive. You can edit
            work lanes from the board.
          </p>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create board"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
