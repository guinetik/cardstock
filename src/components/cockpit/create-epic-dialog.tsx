"use client";

import { RocketIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createEpic } from "@/app/p/[project]/b/[board]/cockpit/actions";
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

const label =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--color-grey)]";

/**
 * The cockpit's standing "new epic" intake: name plus an optional outcome,
 * staying open between additions the way the task clipper does. Owner, dates
 * and priority live on the epic's flight plan once it exists.
 */
export function CreateEpicDialog({ boardId }: { boardId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await createEpic(boardId, { name, outcome });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAdded((list) => [result.epic.source_name, ...list]);
    setName("");
    setOutcome("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <RocketIcon aria-hidden="true" />
            Add an epic
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
            <DialogTitle className="text-xl">Name a new epic</DialogTitle>
            <DialogDescription>
              An epic groups tasks into one delivery signal. Owner, dates and
              priority can be set on its flight plan afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <label htmlFor="epic-name">
              <span className={label}>Epic name</span>
              <Input
                id="epic-name"
                required
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="What is being delivered?"
                disabled={busy}
                autoFocus
              />
            </label>
            <label htmlFor="epic-outcome">
              <span className={label}>Outcome</span>
              <Input
                id="epic-outcome"
                maxLength={500}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                placeholder="Optional — what done looks like"
                disabled={busy}
              />
            </label>
          </div>

          {error && (
            <p
              className="border-l-2 border-[var(--pen-red)] px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}

          {added.length > 0 && (
            <ul
              className="max-h-32 space-y-1 overflow-y-auto border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--color-grey)]"
              aria-label="Added this session"
            >
              {added.map((item) => (
                <li key={item}>Added {item}</li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Adding…" : "Add epic"}
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
