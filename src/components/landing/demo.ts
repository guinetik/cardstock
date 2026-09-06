/**
 * The cards on the landing page.
 *
 * Invented, deliberately. The page is public, so reading a real board would
 * mean opening one to anonymous readers, and a real board is never in the
 * shape a page needs: the drawer has to look neglected, one lane has to be
 * blocked, and the calendar has to be busy on the days the layout allows.
 * These are art direction, so they live here as data rather than as a query.
 */

import type { LaneMicrocosmRow } from "@/lib/lane-map";

export type DemoStatus =
  | "backlog"
  | "wip"
  | "blocked"
  | "built"
  | "shipped"
  | "held";

export type DemoSignal = "forgotten" | "overdue";

export interface DemoCard {
  id: number;
  title: string;
  epic?: string;
  status?: DemoStatus;
  raised: string;
  priority?: 1 | 2 | 3;
  effort?: "L" | "M" | "H";
  tags?: string[];
  note?: string;
  signal?: DemoSignal;
  tint?: string;
}

export interface DemoLane {
  name: string;
  drawer?: boolean;
  cards: DemoCard[];
}

/** The item section 01 follows from markdown into the board and back out. */
export const ROUND_TRIP_CARD: DemoCard = {
  id: 42,
  title: "Round trip loses the target date on export",
  epic: "Round trip",
  status: "wip",
  raised: "Aug 1",
  priority: 1,
  effort: "L",
  tags: ["etl", "bug"],
  note: "Reproduced on the client board. The exporter writes the lane and the rank and drops target when the card has no planned start.",
};

/** The strip under the hero: a board part way through a review. */
export const BOARD: DemoLane[] = [
  {
    name: "Unsorted",
    drawer: true,
    cards: [
      {
        id: 61,
        title: "Someone asked for a weekly digest",
        raised: "Jun 2",
        signal: "forgotten",
      },
      {
        id: 58,
        title: "Duplicate cards after a failed import",
        raised: "May 19",
        signal: "forgotten",
      },
      { id: 44, title: "Rename the archive lane", raised: "Apr 30" },
    ],
  },
  {
    name: "Now",
    cards: [
      ROUND_TRIP_CARD,
      {
        id: 37,
        title: "Filter by tag from the card itself",
        epic: "Board",
        raised: "Aug 7",
        priority: 2,
        effort: "M",
        tags: ["board"],
        tint: "blue",
      },
      {
        id: 35,
        title: "Migrations run twice on a cold deploy",
        epic: "Platform",
        status: "blocked",
        raised: "Jul 28",
        priority: 1,
        effort: "H",
      },
    ],
  },
  {
    name: "Next",
    cards: [
      {
        id: 29,
        title: "Search by id from anywhere on the board",
        epic: "Board",
        raised: "Aug 11",
        priority: 3,
        effort: "M",
        tags: ["board"],
      },
      {
        id: 24,
        title: "Per-project card template",
        epic: "Docs",
        raised: "Aug 14",
        priority: 2,
        effort: "L",
      },
    ],
  },
  {
    name: "Building",
    cards: [
      {
        id: 18,
        title: "Epic cockpit reads an empty effort column",
        epic: "Planning",
        status: "built",
        raised: "Jul 9",
        priority: 2,
        effort: "M",
        signal: "overdue",
      },
    ],
  },
  {
    name: "Shipped",
    cards: [
      {
        id: 12,
        title: "Lane names are yours to rename",
        status: "shipped",
        raised: "Jul 2",
        effort: "L",
      },
    ],
  },
];

/** The drawer on its own, one card older than the strip's copy. */
export const DRAWER: DemoCard[] = [
  ...(BOARD[0]?.cards ?? []).map((card) => ({ ...card })),
  {
    id: 40,
    title: "Board export should include the archive",
    raised: "Apr 12",
  },
];

/**
 * The miniature board printed on a binder's face. The real `LaneMap` takes
 * these rows straight, so the shape on the landing page is the shape a board
 * actually produces.
 */
export const BINDER_MAP: LaneMicrocosmRow[] = [
  {
    id: "unsorted",
    name: "Unsorted",
    kind: "inbox",
    color: null,
    count: 3,
    vacant: false,
    slips: [
      { color: null, signal: "queued" },
      { color: null, signal: "queued" },
      { color: null, signal: "late" },
    ],
  },
  {
    id: "now",
    name: "Now",
    kind: "work",
    color: null,
    count: 3,
    vacant: false,
    slips: [
      { color: null, signal: "moving" },
      { color: "blue", signal: "moving" },
      { color: null, signal: "blocked" },
    ],
  },
  {
    id: "next",
    name: "Next",
    kind: "work",
    color: null,
    count: 2,
    vacant: false,
    slips: [
      { color: null, signal: "queued" },
      { color: null, signal: "queued" },
    ],
  },
  {
    id: "building",
    name: "Building",
    kind: "built",
    color: null,
    count: 1,
    vacant: false,
    slips: [{ color: null, signal: "late" }],
  },
  {
    id: "shipped",
    name: "Shipped",
    kind: "done",
    color: null,
    count: 1,
    vacant: false,
    slips: [{ color: null, signal: "delivered" }],
  },
];

export interface DemoEpic {
  name: string;
  owner: string;
  goal: string;
  outlook: "at-risk" | "on-track" | "planning";
  progress: string;
}

export const EPICS: DemoEpic[] = [
  {
    name: "Round trip",
    owner: "joao",
    goal: "A file that leaves the folder comes back with the same id.",
    outlook: "at-risk",
    progress: "2 of 5 delivered · 1 blocked",
  },
  {
    name: "Board and cards",
    owner: "joao",
    goal: "Everything a review does, done by dragging.",
    outlook: "on-track",
    progress: "4 of 6 delivered · on target",
  },
  {
    name: "Docs and onboarding",
    owner: "unassigned",
    goal: "A new person gets productive without a call.",
    outlook: "planning",
    progress: "0 of 4 delivered · no target",
  },
];

/** Days that carry a slip in the calendar month, and what sits on them. */
export const CALENDAR: Record<number, { id: number; tint?: string }[]> = {
  3: [{ id: 207 }],
  8: [{ id: 202 }, { id: 97, tint: "blue" }],
  15: [{ id: 96 }],
  17: [{ id: 216, tint: "green" }],
  24: [{ id: 200 }],
};

export const UNSCHEDULED: { id: number; title: string; board: string }[] = [
  {
    id: 231,
    title: "Retire the second staging database",
    board: "platform",
  },
  { id: 232, title: "Write the import guide", board: "backlog" },
  { id: 233, title: "Card colour picker on mobile", board: "backlog" },
];
