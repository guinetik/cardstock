"use client";

import { Search } from "lucide-react";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export function FindCardDialog({
  open,
  onOpenChange,
  onFind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFind: (number: string) => string | null;
}) {
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const found = useRef(false);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setNumber("");
          setError(null);
          found.current = false;
        }
      }}
    >
      <DialogContent
        className="find-card-dialog translate-x-0 translate-y-0"
        initialFocus={input}
        finalFocus={() => !found.current}
      >
        <DialogTitle className="flex items-center gap-2">
          <Search size={18} aria-hidden="true" />
          Find Card
        </DialogTitle>
        <DialogDescription>
          Enter a card number to jump to its lane and keep it open.
        </DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!number) return;
            const problem = onFind(number);
            if (problem) {
              setError(problem);
              input.current?.select();
              return;
            }
            found.current = true;
            onOpenChange(false);
          }}
        >
          <label htmlFor="find-card-number" className="field-label">
            Card number
          </label>
          <div className="find-card-number">
            <span aria-hidden="true">#</span>
            <input
              ref={input}
              id="find-card-number"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={number}
              aria-invalid={!!error}
              aria-describedby={error ? "find-card-error" : undefined}
              onChange={(event) => {
                if (/^\d*$/.test(event.target.value)) {
                  setNumber(event.target.value);
                  setError(null);
                }
              }}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text").trim();
                if (/^#?\d+$/.test(pasted)) {
                  event.preventDefault();
                  setNumber(pasted.replace(/^#/, ""));
                  setError(null);
                }
              }}
            />
          </div>
          {error && (
            <p
              id="find-card-error"
              role="alert"
              className="mt-3 text-sm text-[var(--pen-red)]"
            >
              {error}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--color-grey)]">
              Enter to find · Esc to close
            </span>
            <button type="submit" className="paper-btn" disabled={!number}>
              Find Card
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
