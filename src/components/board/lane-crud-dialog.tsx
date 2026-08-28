"use client";

import { type FormEvent, useState } from "react";
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
import type { Lane } from "@/lib/types";

export type LaneDialogMode =
  | { type: "add" }
  | { type: "rename"; lane: Lane }
  | { type: "delete"; lane: Lane }
  | null;

export function LaneCrudDialog(props: {
  mode: LaneDialogMode;
  lanes: Lane[];
  cardCount: number;
  onClose: () => void;
  onCreate: (name: string) => Promise<string | null>;
  onRename: (laneId: string, name: string) => Promise<string | null>;
  onDelete: (
    laneId: string,
    destinationLaneId: string,
  ) => Promise<string | null>;
}) {
  const { mode } = props;
  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      {mode && (
        <LaneDialogForm
          key={`${mode.type}-${"lane" in mode ? mode.lane.id : "new"}`}
          {...props}
          mode={mode}
        />
      )}
    </Dialog>
  );
}

function LaneDialogForm(
  props: Omit<Parameters<typeof LaneCrudDialog>[0], "mode"> & {
    mode: Exclude<LaneDialogMode, null>;
  },
) {
  const { mode } = props;
  const destinations =
    mode.type === "delete"
      ? props.lanes.filter(
          (lane) => lane.id !== mode.lane.id && lane.kind !== "archive",
        )
      : [];
  const [name, setName] = useState(
    mode.type === "rename" ? mode.lane.name : "",
  );
  const [destination, setDestination] = useState(destinations[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    let nextError: string | null;
    if (mode.type === "add") nextError = await props.onCreate(name);
    else if (mode.type === "rename")
      nextError = await props.onRename(mode.lane.id, name);
    else nextError = await props.onDelete(mode.lane.id, destination);
    setBusy(false);
    if (nextError) setError(nextError);
    else props.onClose();
  }

  const title =
    mode.type === "add"
      ? "Add lane"
      : mode.type === "rename"
        ? `Edit ${mode.lane.name}`
        : `Remove ${mode.lane.name}`;

  return (
    <DialogContent>
      <form onSubmit={submit} className="contents">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode.type === "add" &&
              "The lane key is generated from this name and remains stable for markdown exports."}
            {mode.type === "rename" &&
              "The name is what the board shows. The key is what markdown stores, and it does not change."}
            {mode.type === "delete" &&
              `${props.cardCount} card${props.cardCount === 1 ? "" : "s"} will be moved before the lane is removed.`}
          </DialogDescription>
        </DialogHeader>

        {mode.type !== "delete" ? (
          <div className="grid gap-3">
            <label className="grid gap-1.5" htmlFor="lane-name">
              <span className="text-xs font-medium">Lane name</span>
              <Input
                id="lane-name"
                autoFocus
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy}
              />
            </label>
            {mode.type === "rename" && (
              // Worth showing, not hiding in prose: this is the value that
              // ends up in every card's `lane:`, so it is what you match on
              // when a file and the board seem to disagree — and it can read
              // nothing like the name above it.
              <label className="grid gap-1.5" htmlFor="lane-key">
                <span className="text-xs font-medium">Markdown key</span>
                <Input
                  id="lane-key"
                  readOnly
                  value={mode.lane.key}
                  onFocus={(event) => event.target.select()}
                  className="font-mono text-muted-foreground"
                />
              </label>
            )}
          </div>
        ) : (
          <label className="grid gap-1.5" htmlFor="lane-destination">
            <span className="text-xs font-medium">Move cards to</span>
            <select
              id="lane-destination"
              aria-label="Move cards to"
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
              required
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              disabled={busy}
            >
              {destinations.map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="submit"
            variant={mode.type === "delete" ? "destructive" : "default"}
            disabled={busy || (mode.type === "delete" && !destination)}
          >
            {busy
              ? "Saving…"
              : mode.type === "add"
                ? "Add lane"
                : mode.type === "rename"
                  ? "Save name"
                  : "Move cards and remove"}
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
