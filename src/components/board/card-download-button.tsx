"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { useCardSaves } from "@/components/card-save-scope";
import { Button } from "@/components/ui/button";

export function CardDownloadButton({
  href,
  externalId,
}: {
  href: string;
  externalId: string;
}) {
  const saves = useCardSaves();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Also covers keyboard activation and browsers that don't focus a clicked button.
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      const blocked = await saves.ready();
      if (blocked) {
        setError(blocked);
        return;
      }
      const response = await fetch(href, {
        cache: "no-store",
        redirect: "error",
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("text/markdown")
      )
        throw new Error("Download failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${externalId}.md`;
      document.body.append(link);
      link.click();
      link.remove();
      // Give the browser time to consume the object URL before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(
        "Could not download this card. Check your connection and sign-in, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex max-w-full flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void download()}
      >
        <Download aria-hidden="true" />
        {busy ? "Preparing…" : "Download markdown"}
      </Button>
      {error && (
        <p role="alert" className="max-w-64 text-xs text-[var(--pen-red)]">
          {error}
        </p>
      )}
    </div>
  );
}
