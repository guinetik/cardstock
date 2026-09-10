import { type CardPlan, summarizeSyncPlan } from "./sync-plan";

export interface ConflictResolution {
  externalId: string;
  /** Omit to choose this side for every conflicting field on the selected card. */
  field?: string;
  side: "ours" | "theirs";
}

/** Ours is always local Markdown; theirs is always the hosted board. */
export function resolveSyncConflicts(
  plan: ReturnType<typeof summarizeSyncPlan>,
  resolutions: ConflictResolution[],
) {
  const cards: CardPlan[] = structuredClone(plan.cards);
  const selected = new Set<string>();
  for (const resolution of resolutions) {
    if (!["ours", "theirs"].includes(resolution.side))
      throw new Error("Unknown conflict side");
    const original = plan.cards.find(
      (card) => card.externalId === resolution.externalId,
    );
    const card = cards.find(
      (card) => card.externalId === resolution.externalId,
    );
    if (!original || !card)
      throw new Error(`No conflict found for #${resolution.externalId}`);
    if (original.action === "conflict" && !original.changes.length)
      throw new Error(
        `Cannot resolve missing identity #${card.externalId} by choosing a content side`,
      );
    if (
      original.changes.some((change) =>
        change.reason?.startsWith("identity_collision"),
      )
    )
      throw new Error(
        `Confirm the identity collision for #${card.externalId} before choosing content`,
      );
    const conflicts = original.changes.filter(
      (change) =>
        change.direction === "conflict" &&
        (resolution.field === undefined || resolution.field === change.field),
    );
    if (!conflicts.length)
      throw new Error(`No matching conflict on #${card.externalId}`);
    for (const conflict of conflicts) {
      const key = `${card.externalId}:${conflict.field}`;
      if (selected.has(key))
        throw new Error(`Conflict ${key} was selected more than once`);
      selected.add(key);
      const change = card.changes.find(
        (entry) => entry.field === conflict.field,
      );
      if (!change) throw new Error("Conflict field disappeared");
      change.direction = resolution.side === "ours" ? "upload" : "download";
      change.resolution = resolution.side;
    }
    card.action = card.changes.some((change) => change.direction === "conflict")
      ? "conflict"
      : "update";
    const existence = card.changes.find(
      (change) => change.field === "existence",
    );
    if (existence && existence.direction !== "conflict") {
      const ours = existence.direction === "upload";
      const exists = (ours ? existence.local : existence.remote).value;
      card.action = exists
        ? ours
          ? "restore_remote"
          : "create_local"
        : ours
          ? "delete_remote"
          : "delete_local";
    }
  }
  return summarizeSyncPlan(cards);
}

export function parseConflictSelections(
  ours: string[] = [],
  theirs: string[] = [],
): ConflictResolution[] {
  return [
    ...ours.map((value) => ({ value, side: "ours" as const })),
    ...theirs.map((value) => ({ value, side: "theirs" as const })),
  ].map(({ value, side }) => {
    const match =
      /^([1-9]\d*)(?::(existence|body|checklist|frontmatter\..+))?$/.exec(
        value,
      );
    if (!match)
      throw new Error(
        `Use --${side} <id> or --${side} <id>:<existence|body|checklist|frontmatter.key>`,
      );
    return {
      externalId: match[1],
      ...(match[2] ? { field: match[2] } : {}),
      side,
    };
  });
}
