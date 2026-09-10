/** The board's sibling views, in the order the topbar lists them. */
export const BOARD_VIEWS = [
  /** The board itself: the route with no view segment. */
  { segment: "", label: "Board" },
  { segment: "cockpit", label: "Epic Cockpit" },
  { segment: "calendar", label: "Calendar" },
  { segment: "timeline", label: "Timeline" },
  { segment: "priorities", label: "Priorities" },
  { segment: "manage", label: "Configuration" },
] as const;

/** `/p/{project}/b/{board}`, the prefix every board view hangs off. */
export function boardBase(project: string, board: string): string {
  return `/p/${project}/b/${board}`;
}

export function boardViewHref(base: string, segment: string): string {
  return segment ? `${base}/${segment}` : base;
}

/**
 * Which view a board path is sitting in, `""` for the board itself. Matches on
 * the prefix, so routes nested under a view (an epic sheet, a card sheet) count
 * as that view — but only the top segment travels, since the ids below it
 * belong to one board and mean nothing on the next.
 */
export function boardViewSegment(pathname: string, base: string): string {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  return (
    BOARD_VIEWS.find(
      (view) => view.segment && rest.startsWith(`/${view.segment}`),
    )?.segment ?? ""
  );
}
