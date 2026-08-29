const STATUS_CHIP: Record<string, string> = {
  wip: "stat stat--wip",
  built: "stat stat--info",
  handed: "stat stat--info",
  held: "stat stat--muted",
  blocked: "stat stat--blocked",
  shipped: "stat stat--success",
  done: "stat stat--success",
  backlog: "stat stat--muted",
};

/**
 * Class list for a status word — same pens on the card and in the filter bar.
 */
export function statusChipClass(status: string): string {
  return STATUS_CHIP[status] ?? "stat stat--muted";
}
