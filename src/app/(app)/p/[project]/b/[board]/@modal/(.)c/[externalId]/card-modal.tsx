"use client";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * The sheet laid over the board. Always open while this route is active;
 * closing it (Esc, backdrop, the X) is a step back in history, which is what
 * un-intercepts the card route and leaves the board where it was.
 */
export function CardModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DialogContent
        className="card-modal-sheet block max-h-[92vh] w-[min(56rem,calc(100%-2rem))] max-w-none overflow-y-auto bg-transparent p-0 ring-0 sm:max-w-none"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Card</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
