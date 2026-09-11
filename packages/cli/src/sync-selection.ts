import path from "node:path";
import type { Baseline } from "@cardstock/core";
import { readOptional } from "./sync-files";

export function parseCard(value: string | undefined) {
  if (
    value !== undefined &&
    (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
  )
    throw new Error("--card must be a positive card ID, such as --card 19");
  return value;
}

export function selectBaseline(baseline: Baseline | undefined, card?: string) {
  return baseline && card
    ? {
        ...baseline,
        cards: baseline.cards.filter((item) => item.externalId === card),
      }
    : baseline;
}

export async function loadSelectedCard(tracker: string, card: string) {
  const file = `${card}.md`;
  const markdown = await readOptional(path.join(tracker, file));
  return markdown === null ? [] : [{ file, markdown }];
}

export function requireSelectedCard(
  card: string | undefined,
  local: { file: string }[],
  remote: { externalId: string }[],
  baseline?: Baseline,
) {
  if (card && !local.length && !remote.length && !baseline?.cards.length)
    throw new Error(
      `Card #${card} was not found locally, remotely, or in the baseline`,
    );
}
