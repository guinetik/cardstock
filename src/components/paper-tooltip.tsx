"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Props for {@link PaperTooltipContent}. */
export type PaperTooltipContentProps = ComponentProps<typeof TooltipContent>;

/**
 * Tooltip body styled for the paper theme: raised surface, ink type, lift
 * shadow, and slightly larger copy than the default UI tooltip.
 */
export function PaperTooltipContent({
  className,
  children,
  side = "top",
  sideOffset = 6,
  ...props
}: PaperTooltipContentProps) {
  return (
    <TooltipContent
      side={side}
      sideOffset={sideOffset}
      className={cn("paper-tooltip", className)}
      {...props}
    >
      {children}
    </TooltipContent>
  );
}

/** Props for {@link PaperTooltip}. */
export interface PaperTooltipProps {
  /** Tooltip copy; use {@link PaperTooltipLines} for stacked hints. */
  content: ReactNode;
  children: ReactNode;
  side?: PaperTooltipContentProps["side"];
  align?: PaperTooltipContentProps["align"];
  triggerClassName?: string;
  contentClassName?: string;
  triggerProps?: Omit<
    ComponentProps<typeof TooltipTrigger>,
    "className" | "children"
  >;
}

/**
 * Hover hint for board chrome and other paper surfaces. Requires a
 * {@link TooltipProvider} ancestor — the board view wraps the desk with one.
 */
export function PaperTooltip({
  content,
  children,
  side = "top",
  align = "center",
  triggerClassName,
  contentClassName,
  triggerProps,
}: PaperTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        {...triggerProps}
        className={cn(
          "cursor-help border-0 bg-transparent p-0 text-inherit",
          triggerClassName,
        )}
      >
        {children}
      </TooltipTrigger>
      <PaperTooltipContent
        side={side}
        align={align}
        className={contentClassName}
      >
        {content}
      </PaperTooltipContent>
    </Tooltip>
  );
}

/** Props for {@link PaperTooltipLines}. */
export interface PaperTooltipLinesProps {
  lines: Array<string | null | undefined | false>;
}

/**
 * Stacked tooltip copy: a lead line, optional muted meta, then the hint.
 */
export function PaperTooltipLines({ lines }: PaperTooltipLinesProps) {
  const visible = lines.filter(
    (line): line is string => typeof line === "string" && line.length > 0,
  );
  if (!visible.length) return null;

  return (
    <span className="paper-tooltip__stack">
      {visible.map((line, index) => (
        <span
          key={line}
          className={cn(
            index === 0
              ? "paper-tooltip__lead"
              : index === visible.length - 1 && visible.length > 1
                ? "paper-tooltip__hint"
                : "paper-tooltip__meta",
          )}
        >
          {line}
        </span>
      ))}
    </span>
  );
}
