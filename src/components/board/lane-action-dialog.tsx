"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Lane } from "@/lib/types";

export type LaneActionMode =
  | {
      type: "move-cards";
      lane: Lane;
      destination: Lane;
      cardCount: number;
    }
  | {
      type: "sort-cards";
      lane: Lane;
      direction: "asc" | "desc";
      cardCount: number;
    }
  | null;

export function laneActionCopy(mode: Exclude<LaneActionMode, null>) {
  if (mode.type === "move-cards") {
    return {
      title: `Move all cards from ${mode.lane.name}?`,
      description: `${mode.cardCount} card${mode.cardCount === 1 ? "" : "s"} will be moved to ${mode.destination.name} after its existing cards. The current order will be preserved.`,
      submit: "Move all cards",
    };
  }
  const direction = mode.direction === "asc" ? "ascending" : "descending";
  return {
    title: `Order ${mode.lane.name} by card number?`,
    description: `${mode.cardCount} card${mode.cardCount === 1 ? "" : "s"} will be ordered by card number ${direction}. This replaces the lane’s current manual order.`,
    submit: `Order ${direction}`,
  };
}

/** Confirmation for lane-wide mutations that replace location or manual order. */
export function LaneActionDialog(props: {
  mode: LaneActionMode;
  onClose: () => void;
  onConfirm: (mode: Exclude<LaneActionMode, null>) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = props.mode;

  async function confirm() {
    if (!mode) return;
    setBusy(true);
    setError(null);
    const nextError = await props.onConfirm(mode);
    setBusy(false);
    if (nextError) setError(nextError);
    else props.onClose();
  }

  const copy = mode ? laneActionCopy(mode) : null;

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open && !busy) props.onClose();
      }}
    >
      {mode && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>{copy?.description}</DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Filters do not affect this action.
          </p>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? "Saving…" : copy?.submit}
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
        </DialogContent>
      )}
    </Dialog>
  );
}
