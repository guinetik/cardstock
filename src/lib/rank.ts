/** Fractional ranking. Ranks are doubles; a move writes the midpoint of its neighbours. */
export const RANK_STEP = 1;
export const MIN_GAP = 1e-6;

export function rankBetween(
  before: number | null,
  after: number | null,
): number {
  if (before == null && after == null) return RANK_STEP;
  if (before == null) return (after as number) - RANK_STEP;
  if (after == null) return before + RANK_STEP;
  return (before + after) / 2;
}

/** True when a lane's ranks are too close to keep halving safely. */
export function needsNormalize(ranks: number[]): boolean {
  const s = ranks.slice().sort((a, b) => a - b);
  for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] < MIN_GAP) return true;
  return false;
}

/** Ranks for a lane's ids in display order: 1, 2, 3… */
export function normalized(ids: string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, (i + 1) * RANK_STEP]));
}
