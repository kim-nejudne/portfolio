export type Tally = { [option: string]: number };

/** How many votes each option got. */
export function tally(votes: string[]): Tally {
  const totals: Tally = {};
  for (const vote of votes) {
    totals[vote] = (totals[vote] ?? 0) + 1;
  }
  return totals;
}
