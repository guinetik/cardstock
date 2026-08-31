"use client";

import type { GateOutcome } from "@/lib/gates";
import type { TimelineSignal } from "@/lib/timeline";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIGNAL_LABEL: Record<TimelineSignal, string> = {
  forgotten: "Forgotten",
  overdue: "Overdue",
  planned: "Planned",
  active: "Open",
  delivered: "Delivered",
};

const SIGNAL_HINT: Record<TimelineSignal, string> = {
  forgotten:
    "Assessment — raised past the watch window with no target date. The calendar is the problem, not the lane.",
  overdue:
    "Assessment — the target date has passed and this is not shipped.",
  planned: "Assessment — has a ship date, not late, not out yet.",
  active: "Assessment — open, too new to nag, no target yet.",
  delivered: "Assessment — it has shipped.",
};

const SIGNAL_COLOR: Record<TimelineSignal, string> = {
  forgotten: "var(--pen-red)",
  overdue: "var(--pen-amber)",
  planned: "var(--pen-blue)",
  active: "var(--color-grey-faint)",
  delivered: "var(--pen-green)",
};

const GATE_COLOR: Record<GateOutcome, string> = {
  built: "var(--pen-blue)",
  shipped: "var(--pen-green)",
};

function gateHint(outcome: GateOutcome | null) {
  if (outcome === "built")
    return "Gate — where this work is in this board's process. Counts toward the Built column.";
  if (outcome === "shipped")
    return "Gate — where this work is in this board's process. Counts toward the Shipped column.";
  return "Gate — where this work is in this board's process.";
}

function Mark({
  kind,
  value,
  hint,
  color,
  ruled,
}: {
  kind: "Assess" | "Gate";
  value: string;
  hint: string;
  color: string;
  ruled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger className="flex cursor-help items-baseline justify-end gap-1.5 border-0 bg-transparent p-0">
        <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[var(--color-grey)]">
          {kind}
        </span>
        <span
          className={
            ruled
              ? "border-l-2 pl-1.5 text-[9px] font-semibold uppercase tracking-[0.1em]"
              : "text-[9px] font-semibold uppercase tracking-[0.1em]"
          }
          style={ruled ? { borderColor: color, color } : { color }}
        >
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">{hint}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Gate vs calendar assessment, labeled, with a hover that spells the axis out.
 */
export function TimelineMarks({
  signal,
  gateName,
  gateOutcome,
}: {
  signal: TimelineSignal;
  gateName: string | null;
  gateOutcome: GateOutcome | null;
}) {
  const color = SIGNAL_COLOR[signal];
  return (
    <TooltipProvider delay={200}>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <Mark
          kind="Assess"
          value={SIGNAL_LABEL[signal]}
          hint={SIGNAL_HINT[signal]}
          color={color}
          ruled
        />
        {gateName && (
          <Mark
            kind="Gate"
            value={gateName}
            hint={gateHint(gateOutcome)}
            color={
              gateOutcome ? GATE_COLOR[gateOutcome] : "var(--color-ink)"
            }
          />
        )}
      </span>
    </TooltipProvider>
  );
}
