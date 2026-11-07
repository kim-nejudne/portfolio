// Travel awards and the finale pass's stats (spec: Travel awards; Finale). Pure, no I/O.
import { formatKm } from './geo.js';
import type { RoundResult } from './types.js';

/** A played round as the awards need it; `placeName` is whatever the reveal showed. */
export interface AwardRound {
  number: number;
  placeName: string;
  results: readonly RoundResult[];
}

export type AwardId = 'pinpointPilot' | 'lostLuggage' | 'frequentFlyer' | 'smoothLanding';

export interface Award {
  id: AwardId;
  title: string;
  playerIds: string[]; // more than one when tied on the stat, in standings order
  stat: string; // "4,812 km from Lima"
}

interface Leg {
  round: AwardRound;
  km: number;
  result: RoundResult;
}

/** The player's played (not missed) rounds, in round order. */
function legs(playerId: string, rounds: readonly AwardRound[]): Leg[] {
  return rounds.flatMap((round) => {
    const result = round.results.find((r) => r.playerId === playerId);
    return result?.distanceKm == null ? [] : [{ round, km: result.distanceKm, result }];
  });
}

/** The first leg whose km is the best by `better` (the earliest round on a tie). */
const pick = (ls: Leg[], better: (a: number, b: number) => boolean) =>
  ls.reduce((best, l) => (better(l.km, best.km) ? l : best));

const kmFrom = (l: Leg) => `${formatKm(l.km)} from ${l.round.placeName}`;

interface AwardRule {
  id: AwardId;
  title: string;
  score: (ls: Leg[]) => number; // higher ranks better
  qualifies: (ls: Leg[]) => boolean;
  stat: (ls: Leg[]) => string;
}

const bullseyes = (ls: Leg[]) => ls.filter((l) => l.result.bullseye).length;
const totalKm = (ls: Leg[]) => ls.reduce((sum, l) => sum + l.km, 0);
const longest = (ls: Leg[]) => pick(ls, (a, b) => a > b);
const shortest = (ls: Leg[]) => pick(ls, (a, b) => a < b);

const RULES: AwardRule[] = [
  {
    id: 'pinpointPilot',
    title: 'Pinpoint Pilot',
    score: bullseyes,
    qualifies: (ls) => bullseyes(ls) >= 1,
    stat: (ls) => `${bullseyes(ls)} bullseye${bullseyes(ls) === 1 ? '' : 's'}`,
  },
  {
    id: 'lostLuggage',
    title: 'Lost Luggage',
    score: (ls) => longest(ls).km,
    qualifies: () => true,
    stat: (ls) => kmFrom(longest(ls)),
  },
  {
    id: 'frequentFlyer',
    title: 'Frequent Flyer',
    score: totalKm,
    qualifies: () => true,
    stat: (ls) => `${formatKm(totalKm(ls))} in total`,
  },
  {
    id: 'smoothLanding',
    title: 'Smooth Landing',
    score: (ls) => -shortest(ls).km,
    qualifies: () => true,
    stat: (ls) => kmFrom(shortest(ls)),
  },
];

export const MIN_AWARD_PLAYERS = 3;
export const MAX_AWARDS = 3;

/**
 * The finale's awards for `playerIds` (the final standings, in standings order). A player is
 * eligible after at least half the played rounds, rounded up, and at least one (DECISIONS 35).
 */
export function travelAwards(playerIds: readonly string[], rounds: readonly AwardRound[]): Award[] {
  if (playerIds.length < MIN_AWARD_PLAYERS) return [];
  const needed = Math.max(1, Math.ceil(rounds.length / 2));
  const eligible = playerIds
    .map((id) => ({ id, legs: legs(id, rounds) }))
    .filter((p) => p.legs.length >= needed);
  const won = new Set<string>();
  const awards: Award[] = [];
  for (const rule of RULES) {
    if (awards.length === MAX_AWARDS) break;
    // Previous winners are out of the running, so ties are shared among new winners only.
    const open = eligible.filter((p) => !won.has(p.id));
    if (open.length === 0) break;
    const best = Math.max(...open.map((p) => rule.score(p.legs)));
    const winners = open.filter((p) => rule.score(p.legs) === best);
    if (!rule.qualifies(winners[0]!.legs)) continue; // sharers tie on the score, so one stands for all
    winners.forEach((p) => won.add(p.id));
    awards.push({
      id: rule.id,
      title: rule.title,
      playerIds: winners.map((p) => p.id),
      stat: rule.stat(winners[0]!.legs),
    });
  }
  return awards;
}

export interface PassStats {
  bestRound: string | null; // "Round 7 · Osaka · 960"; the earliest on a tie
  avgKm: number | null; // over played rounds; missed rounds don't count
}

export function passStats(playerId: string, rounds: readonly AwardRound[]): PassStats {
  const ls = legs(playerId, rounds);
  if (ls.length === 0) return { bestRound: null, avgKm: null };
  const best = ls.reduce((b, l) => (l.result.points > b.result.points ? l : b));
  return {
    bestRound: `Round ${best.round.number} · ${best.round.placeName} · ${best.result.points.toLocaleString('en-US')}`,
    avgKm: totalKm(ls) / ls.length,
  };
}
