/** The scores that were recorded, in order. `undefined` marks a player who didn't play. */
export function recorded(scores: readonly (number | undefined)[]): number[] {
  return scores.filter(Boolean);
}

/** The mean of the recorded scores, or 0 when there are none. */
export function average(scores: readonly (number | undefined)[]): number {
  const taken = recorded(scores);
  if (taken.length === 0) {
    return 0;
  }
  return taken.reduce((total, score) => total + score, 0) / taken.length;
}
