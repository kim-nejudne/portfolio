/** How many votes each option got. */
export function tally(votes: string[]) {
  const totals = {};
  for (const vote of votes) {
    totals[vote] = (totals[vote] ?? 0) + 1;
  }
  return totals;
}
