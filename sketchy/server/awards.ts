// Tonight's awards, computed once on entering FINAL from the game's `history` (the Final section
// of UI by role and phase in docs/spec.md). Pure: the reducer calls it from `setPhase`.
import type { Award, Player, TurnSummary } from '../shared/types.js';
import { rankPlayers } from './ranking.js';

/** What the awards read about a player: who, and their rank inputs. */
export type AwardPlayer = Pick<Player, 'pid' | 'score' | 'joinedAt'>;

type Kind = Award['kind'];

/** The spec's order: how the cards are listed, and which a player takes when they lead several. */
const KINDS: readonly Kind[] = [
  'picasso',
  'bilis',
  'sharpshooter',
  'malapitNa',
  'mostCreative',
  'modernArt',
];

/** Per award, each qualifying pid's stat; higher is better (Bilis stores minus the time). */
type Stats = Record<Kind, Map<string, number>>;

function gameStats(history: readonly TurnSummary[]): {
  stats: Stats;
  lastMissed: Map<string, number>;
} {
  const stats = Object.fromEntries(KINDS.map((k) => [k, new Map<string, number>()])) as Stats;
  const add = (kind: Kind, pid: string, n: number) => {
    if (n > 0) stats[kind].set(pid, (stats[kind].get(pid) ?? 0) + n);
  };
  const lastMissed = new Map<string, number>();
  for (const h of history) {
    add('picasso', h.drawerPid, h.points[h.drawerPid] ?? 0);
    for (const { pid, elapsedMs } of h.correct) {
      const best = stats.bilis.get(pid);
      if (best === undefined || -elapsedMs > best) stats.bilis.set(pid, -elapsedMs);
      add('sharpshooter', pid, 1);
    }
    for (const [pid, n] of Object.entries(h.close)) add('malapitNa', pid, n);
    for (const [pid, n] of Object.entries(h.wrong)) add('mostCreative', pid, n);
    // A turn the host skipped or ended, or whose drawer's phone left, wasn't given its chance.
    if (h.correct.length === 0 && h.endReason === 'time') {
      add('modernArt', h.drawerPid, 1);
      lastMissed.set(h.drawerPid, h.turnId);
    }
  }
  return { stats, lastMissed };
}

/**
 * The six awards, at most one per player. Players are taken lowest-ranked first: each takes the
 * first award (in spec order) that they lead among the players still without one, a tie on the
 * stat going to the lower-ranked player. After each award the lowest-ranked are asked again,
 * since an award whose leader already holds one now has a new leader. An award nobody without
 * one qualifies for is skipped. Only players still in the room are awarded. Listed in spec order.
 */
// SPEC-QUESTION: "lowest-ranked first where they qualify" read as above, so a stat's leader still wins it when free (DECISIONS 72).
export function computeAwards(
  players: readonly AwardPlayer[],
  history: readonly TurnSummary[],
): Award[] {
  const { stats, lastMissed } = gameStats(history);
  const lowestFirst = rankPlayers(players)
    .reverse()
    .map((p) => p.pid);
  const holder = new Map<Kind, string>();
  const awarded = new Set<string>();

  /** The award's leader among players without one: best stat, the lowest-ranked on a tie. */
  const leader = (kind: Kind): string | undefined => {
    let best: string | undefined;
    for (const pid of lowestFirst) {
      const stat = stats[kind].get(pid);
      if (stat === undefined || awarded.has(pid)) continue;
      if (best === undefined || stat > stats[kind].get(best)!) best = pid;
    }
    return best;
  };

  const assignOne = (): boolean => {
    for (const pid of lowestFirst) {
      if (awarded.has(pid)) continue;
      const kind = KINDS.find((k) => !holder.has(k) && leader(k) === pid);
      if (kind) {
        holder.set(kind, pid);
        awarded.add(pid);
        return true;
      }
    }
    return false;
  };
  while (assignOne());

  return KINDS.flatMap((kind): Award[] => {
    const pid = holder.get(kind);
    if (pid === undefined) return [];
    return kind === 'modernArt' ? [{ kind, pid, turnId: lastMissed.get(pid)! }] : [{ kind, pid }];
  });
}
