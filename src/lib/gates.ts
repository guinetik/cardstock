import { CARD_STATUSES, type CardStatus, isCardStatus } from "./card-status";
import type { Lane } from "./types";

export const GATES_SETTING = "gates";
export const DEFAULT_SHIPPED_GATE_ID = "default-shipped";
export const DEFAULT_BUILT_GATE_ID = "default-built";
export const GATE_NAME_MAX = 80;

/**
 * What "built" and "shipped" mean is the board's call, not the app's: a
 * board maps its own statuses onto the two outcomes, stored in board
 * settings so a future screen can edit the assignment. Lane kinds remain a
 * second, independent source of the same evidence.
 */
export const TIMELINE_BUILT_STATUSES_SETTING = "timeline_built_statuses";
export const TIMELINE_SHIPPED_STATUSES_SETTING = "timeline_shipped_statuses";
export const DEFAULT_BUILT_STATUSES: readonly CardStatus[] = [
  "built",
  "handed",
];
export const DEFAULT_SHIPPED_STATUSES: readonly CardStatus[] = [
  "shipped",
  "done",
];

export type GateOutcome = "built" | "shipped";

export interface BoardGate {
  id: string;
  name: string;
  statuses: string[];
  lane_ids: string[];
  outcome: GateOutcome | null;
}

/** Valid non-empty status list, else the fallback — same rule as timeline outcomes. */
export function statusList(
  value: unknown,
  fallback: readonly CardStatus[],
): ReadonlySet<string> {
  const valid =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (status) =>
        typeof status === "string" &&
        (CARD_STATUSES as readonly string[]).includes(status),
    );
  return new Set(valid ? (value as string[]) : fallback);
}

function isGateOutcome(value: unknown): value is GateOutcome {
  return value === "built" || value === "shipped";
}

function parseOutcome(value: unknown): GateOutcome | null | undefined {
  if (value === undefined || value === null) return null;
  if (isGateOutcome(value)) return value;
  return undefined;
}

/** Clean a saved gates array, or null when any element is invalid. */
function parseGates(
  value: unknown[],
  laneIdSet: ReadonlySet<string>,
): BoardGate[] | null {
  const seenIds = new Set<string>();
  const gates: BoardGate[] = [];

  for (const element of value) {
    if (!element || typeof element !== "object" || Array.isArray(element)) {
      return null;
    }
    const row = element as Record<string, unknown>;

    if (typeof row.id !== "string" || row.id.trim() === "") return null;
    const id = row.id;
    if (seenIds.has(id)) return null;
    seenIds.add(id);

    if (typeof row.name !== "string") return null;
    const name = row.name.trim();
    if (name.length < 1 || name.length > GATE_NAME_MAX) return null;

    if (!Array.isArray(row.statuses)) return null;
    if (!row.statuses.every((status) => isCardStatus(status))) return null;
    const statuses = row.statuses as string[];

    if (!Array.isArray(row.lane_ids)) return null;
    if (!row.lane_ids.every((laneId) => typeof laneId === "string")) {
      return null;
    }
    const lane_ids = (row.lane_ids as string[]).filter((laneId) =>
      laneIdSet.has(laneId),
    );

    const outcome = parseOutcome(row.outcome);
    if (outcome === undefined) return null;

    if (statuses.length === 0 && lane_ids.length === 0) return null;

    gates.push({ id, name, statuses, lane_ids, outcome });
  }

  return gates;
}

function defaultBoardGates(
  settings: Record<string, unknown> | null | undefined,
  lanes: Pick<Lane, "id" | "kind">[],
): BoardGate[] {
  return [
    {
      id: DEFAULT_SHIPPED_GATE_ID,
      name: "Shipped",
      statuses: [
        ...statusList(
          settings?.[TIMELINE_SHIPPED_STATUSES_SETTING],
          DEFAULT_SHIPPED_STATUSES,
        ),
      ],
      lane_ids: lanes.filter((lane) => lane.kind === "done").map((lane) => lane.id),
      outcome: "shipped",
    },
    {
      id: DEFAULT_BUILT_GATE_ID,
      name: "Built",
      statuses: [
        ...statusList(
          settings?.[TIMELINE_BUILT_STATUSES_SETTING],
          DEFAULT_BUILT_STATUSES,
        ),
      ],
      lane_ids: lanes
        .filter((lane) => lane.kind === "built")
        .map((lane) => lane.id),
      outcome: "built",
    },
  ];
}

/**
 * Effective gates for a board: a valid saved list (including `[]`), else
 * synthesized Shipped then Built defaults.
 */
export function resolveBoardGates(
  settings: Record<string, unknown> | null | undefined,
  lanes: Pick<Lane, "id" | "kind">[],
): BoardGate[] {
  const laneIdSet = new Set(lanes.map((lane) => lane.id));
  const raw = settings?.[GATES_SETTING];
  if (Array.isArray(raw)) {
    const parsed = parseGates(raw, laneIdSet);
    if (parsed) return parsed;
  }
  return defaultBoardGates(settings, lanes);
}

/**
 * First matching gate for a card, or null. Status and lane are OR; an empty
 * side does not match.
 */
export function cardGate(
  card: Pick<{ status: string; lane_id: string | null }, "status" | "lane_id">,
  gates: readonly BoardGate[],
): BoardGate | null {
  for (const gate of gates) {
    const statusMatch =
      gate.statuses.length > 0 && gate.statuses.includes(card.status);
    const laneMatch =
      !!card.lane_id &&
      gate.lane_ids.length > 0 &&
      gate.lane_ids.includes(card.lane_id);
    if (statusMatch || laneMatch) return gate;
  }
  return null;
}

/** Union of statuses and lane ids for each outcome across the gate list. */
export function gateOutcomeSets(gates: readonly BoardGate[]): {
  built: { statuses: ReadonlySet<string>; laneIds: ReadonlySet<string> };
  shipped: { statuses: ReadonlySet<string>; laneIds: ReadonlySet<string> };
} {
  const builtStatuses = new Set<string>();
  const builtLaneIds = new Set<string>();
  const shippedStatuses = new Set<string>();
  const shippedLaneIds = new Set<string>();

  for (const gate of gates) {
    if (gate.outcome === "built") {
      for (const status of gate.statuses) builtStatuses.add(status);
      for (const laneId of gate.lane_ids) builtLaneIds.add(laneId);
    } else if (gate.outcome === "shipped") {
      for (const status of gate.statuses) shippedStatuses.add(status);
      for (const laneId of gate.lane_ids) shippedLaneIds.add(laneId);
    }
  }

  return {
    built: { statuses: builtStatuses, laneIds: builtLaneIds },
    shipped: { statuses: shippedStatuses, laneIds: shippedLaneIds },
  };
}

/**
 * Pulse column title for an outcome: the sole gate's name, else Built/Shipped.
 */
export function pulseHeading(
  gates: readonly BoardGate[],
  outcome: GateOutcome,
): string {
  const matching = gates.filter((gate) => gate.outcome === outcome);
  if (matching.length === 1) return matching[0]!.name;
  return outcome === "built" ? "Built" : "Shipped";
}

/**
 * Validate a gates payload for persistence. Rejects unknown lanes instead of
 * dropping them; first failure wins.
 */
export function validateGatesForSave(
  value: unknown,
  boardLaneIds: ReadonlySet<string>,
): { ok: true; gates: BoardGate[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Gates could not be saved." };
  }

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const gates: BoardGate[] = [];

  for (const element of value) {
    if (!element || typeof element !== "object" || Array.isArray(element)) {
      return { ok: false, error: "Gates could not be saved." };
    }
    const row = element as Record<string, unknown>;

    if (typeof row.id !== "string" || row.id.trim() === "") {
      return { ok: false, error: "A gate is missing an id." };
    }
    const id = row.id;
    if (seenIds.has(id)) {
      return { ok: false, error: "Two gates cannot share an id." };
    }
    seenIds.add(id);

    if (typeof row.name !== "string") {
      return {
        ok: false,
        error: "Every gate needs a name (80 characters or fewer).",
      };
    }
    const name = row.name.trim();
    if (name.length < 1 || name.length > GATE_NAME_MAX) {
      return {
        ok: false,
        error: "Every gate needs a name (80 characters or fewer).",
      };
    }
    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) {
      return { ok: false, error: "Two gates cannot share a name." };
    }
    seenNames.add(nameKey);

    if (!Array.isArray(row.statuses)) {
      return { ok: false, error: "Unknown status." };
    }
    for (const status of row.statuses) {
      if (!isCardStatus(status)) {
        return { ok: false, error: "Unknown status." };
      }
    }
    const statuses = row.statuses as string[];

    if (!Array.isArray(row.lane_ids)) {
      return { ok: false, error: "Unknown lane." };
    }
    for (const laneId of row.lane_ids) {
      if (typeof laneId !== "string" || !boardLaneIds.has(laneId)) {
        return { ok: false, error: "Unknown lane." };
      }
    }
    const lane_ids = row.lane_ids as string[];

    let outcome: GateOutcome | null;
    if (row.outcome === undefined || row.outcome === null || row.outcome === "") {
      outcome = null;
    } else if (isGateOutcome(row.outcome)) {
      outcome = row.outcome;
    } else {
      return { ok: false, error: "Choose None, Built, or Shipped." };
    }

    if (statuses.length === 0 && lane_ids.length === 0) {
      return {
        ok: false,
        error: "Each gate needs at least one status or one lane.",
      };
    }

    gates.push({ id, name, statuses, lane_ids, outcome });
  }

  return { ok: true, gates };
}
