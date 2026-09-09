"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCard } from "@/app/(app)/p/[project]/b/[board]/actions";
import { Button } from "@/components/ui/button";
import { CardCreateDialog } from "./card-create-dialog";

/** Reuse the creation form so a clone can be reviewed before a new card is saved. */
export function CardCloneButton({
  boardPath,
  ...props
}: Omit<Parameters<typeof CardCreateDialog>[0], "onClose" | "onCreate"> & {
  boardPath: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!props.lane}
        onClick={() => setOpen(true)}
      >
        <Copy aria-hidden="true" />
        Clone card
      </Button>
      <CardCreateDialog
        {...props}
        lane={open ? props.lane : null}
        onClose={() => setOpen(false)}
        onCreate={async (input) => {
          const result = await createCard(input);
          if (result.ok) {
            router.push(`${boardPath}/c/${result.card.external_id}`);
            router.refresh();
          }
          return result;
        }}
      />
    </>
  );
}
