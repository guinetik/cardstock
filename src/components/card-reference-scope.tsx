"use client";

import { PaperclipIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PaperTooltipLines } from "@/components/paper-tooltip";
import type { CardReferencePreview } from "@/lib/card-references";

interface OpenPreview {
  card: CardReferencePreview;
  left: number;
  top: number;
  below: boolean;
}

const TOOLTIP_HALF_WIDTH = 144;
const TOOLTIP_EDGE_GAP = 8;

function referenceAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element
    ? target.closest<HTMLAnchorElement>("a[data-card-reference]")
    : null;
}

function shortSummary(summary: string | null): string | null {
  if (!summary) return null;
  const oneLine = summary.replaceAll(/\s+/g, " ").trim();
  return oneLine.length > 180 ? `${oneLine.slice(0, 177)}…` : oneLine;
}

/**
 * One portal-based clipped-paper preview for card links inside a named scope.
 * Delegated DOM events also reach links rendered from Markdown via `innerHTML`.
 */
export function CardReferenceScope({
  cards,
  scope,
}: {
  cards: readonly CardReferencePreview[];
  scope: string;
}) {
  const tooltipId = useId();
  const activeAnchor = useRef<HTMLAnchorElement | null>(null);
  const previousDescription = useRef<string | null>(null);
  const [open, setOpen] = useState<OpenPreview | null>(null);
  const byExternalId = useMemo(
    () => new Map(cards.map((card) => [card.external_id, card])),
    [cards],
  );

  useEffect(() => {
    function belongsToScope(anchor: HTMLAnchorElement): boolean {
      return (
        anchor
          .closest<HTMLElement>("[data-card-reference-scope]")
          ?.getAttribute("data-card-reference-scope") === scope
      );
    }

    function restoreAnchor() {
      if (activeAnchor.current) {
        if (previousDescription.current)
          activeAnchor.current.setAttribute(
            "aria-describedby",
            previousDescription.current,
          );
        else activeAnchor.current.removeAttribute("aria-describedby");
      }
      activeAnchor.current = null;
      previousDescription.current = null;
    }

    function close() {
      restoreAnchor();
      setOpen(null);
    }

    function show(anchor: HTMLAnchorElement) {
      if (!belongsToScope(anchor)) return;
      const externalId = anchor.dataset.cardReference;
      const card = externalId ? byExternalId.get(externalId) : null;
      if (!card) {
        close();
        return;
      }

      if (activeAnchor.current !== anchor) {
        close();
        activeAnchor.current = anchor;
        previousDescription.current = anchor.getAttribute("aria-describedby");
        anchor.setAttribute("aria-describedby", tooltipId);
      }

      const rect = anchor.getBoundingClientRect();
      setOpen({
        card,
        left: Math.max(
          TOOLTIP_HALF_WIDTH + TOOLTIP_EDGE_GAP,
          Math.min(
            window.innerWidth - TOOLTIP_HALF_WIDTH - TOOLTIP_EDGE_GAP,
            rect.left + rect.width / 2,
          ),
        ),
        top: rect.top < 140 ? rect.bottom + 10 : rect.top - 10,
        below: rect.top < 140,
      });
    }

    function onPointerOver(event: globalThis.PointerEvent) {
      const anchor = referenceAnchor(event.target);
      if (anchor) show(anchor);
    }

    function onPointerOut(event: globalThis.PointerEvent) {
      const anchor = referenceAnchor(event.target);
      if (
        anchor &&
        belongsToScope(anchor) &&
        !anchor.contains(event.relatedTarget as Node | null)
      )
        close();
    }

    function onFocusIn(event: globalThis.FocusEvent) {
      const anchor = referenceAnchor(event.target);
      if (anchor) show(anchor);
    }

    function onFocusOut(event: globalThis.FocusEvent) {
      const anchor = referenceAnchor(event.target);
      if (
        anchor &&
        belongsToScope(anchor) &&
        !anchor.contains(event.relatedTarget as Node | null)
      )
        close();
    }

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      restoreAnchor();
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [byExternalId, scope, tooltipId]);

  if (!open) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: open.left,
        top: open.top,
        transform: open.below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      }}
    >
      <div
        id={tooltipId}
        role="tooltip"
        data-slot="tooltip-content"
        className="paper-tooltip"
      >
        <PaperclipIcon
          className="paper-tooltip__clip"
          aria-hidden="true"
          strokeWidth={2.1}
        />
        <div className="paper-tooltip__sheet">
          <PaperTooltipLines
            lines={[
              `#${open.card.external_id} · ${open.card.title}`,
              shortSummary(open.card.summary),
            ]}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
