import type { RankedPlayer } from '../../../shared/types.js';

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** A score change as shown on screen: "+100", "−100" (a minus sign, not a hyphen), or "0". */
export function signedPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${-points}`;
  return '0';
}

/** A score with its unit: "1 point", "−1 point", "250 points". */
export function pointsLabel(points: number): string {
  return `${points} ${Math.abs(points) === 1 ? 'point' : 'points'}`;
}

/** One step of the podium: every player who shares that rank stands on it. */
export interface PodiumStep {
  rank: number;
  /** 0 is the top step, 1 the second, 2 the third: it sets the step's height. */
  height: 0 | 1 | 2;
  players: RankedPlayer[];
}

/**
 * The podium for the Final screen (UI spec, Screen view: top-3 podium). Players are grouped by the
 * server's rank, so a tie shares a step; ranks above 3 are left off. With 1, 1, 3 the steps are
 * rank 1 and rank 3. Steps come left to right in the classic order: second, first, third.
 */
export function podiumSteps(players: readonly RankedPlayer[]): PodiumStep[] {
  const ranks = [...new Set(players.map((p) => p.rank))]
    .filter((r) => r <= 3)
    .sort((a, b) => a - b);
  const steps = ranks.map((rank, i) => ({
    rank,
    height: i as PodiumStep['height'],
    players: players.filter((p) => p.rank === rank),
  }));
  return [steps[1], steps[0], steps[2]].filter((step) => step !== undefined);
}

/**
 * The order the scoreboard opens in: the players as they stood when it was last shown, then
 * anyone new, in the current ranking. The overlay then moves to the current ranking, so the
 * audience sees who climbed (UI spec, Screen view: animated reordering).
 */
export function replayOrder(
  previousIds: readonly string[],
  players: readonly RankedPlayer[],
): RankedPlayer[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const kept = previousIds.flatMap((id) => {
    const player = byId.get(id);
    return player ? [player] : [];
  });
  const seen = new Set(previousIds);
  return [...kept, ...players.filter((p) => !seen.has(p.id))];
}
