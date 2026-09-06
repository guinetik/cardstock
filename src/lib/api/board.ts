import { createHash } from "node:crypto";
import type { BoardState } from "@/lib/import/types";

/** A compact token for a board's newest card state and structural shape. */
export function boardEtag(state: BoardState): string {
  let newest = "";
  for (const card of state.cards.values())
    if (card.updated_at > newest) newest = card.updated_at;
  const shape = `${state.lanes.length}:${state.groups.length}:${state.cards.size}`;
  return createHash("sha256")
    .update(`${newest}|${shape}`)
    .digest("hex")
    .slice(0, 32);
}

/** The values a client needs to construct accepted board sheets. */
export function boardVocabulary(state: BoardState) {
  return {
    lanes: state.lanes.map((lane) => ({
      key: lane.key,
      name: lane.name,
      kind: lane.kind,
      position: lane.position,
    })),
    tagGroups: state.groups.map((group) => ({
      key: group.key,
      name: group.name,
      position: group.position,
      tags: group.tags.map((tag) => ({ key: tag.key, name: tag.name })),
    })),
    epics: [...state.epics.keys()].sort(),
    members: state.members.map((member) => ({
      email: member.email,
      name: member.displayName,
    })),
  };
}
