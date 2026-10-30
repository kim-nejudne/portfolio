// The room's deck (spec: Words, Word selection). Pure: randomness comes in as the room's seeded
// RNG, and every function returns a new deck. The deck holds word ids, top first; the entries come
// from the room's packs, filtered by the settings. Server state only: no deck, choice or id is
// ever sent to a Screen or guesser.
import type { ChoiceIndex, Room, RoomSettings, WordEntry, WordPack } from '../shared/types.js';
import type { SeededRng } from './rng.js';

export type Deck = Room['deck'];
export type Choices = [WordEntry, WordEntry, WordEntry];

/** Each deal offers this many words. */
export const CHOICE_COUNT = 3;

/**
 * Every word the settings allow, in pack order: `words` picks the pack languages ('mixed' is
 * both), `spicy` adds the spicy packs of those languages, `difficulty: 'easy'` keeps level 1.
 */
// F48 adds the room's custom words here.
// SPEC-QUESTION: the only spicy pack is 'tl' ("Pang-inuman"), so `spicy` adds nothing to 'en' rooms
// (DECISIONS 69).
export function allowedWords(
  packs: readonly WordPack[],
  settings: Pick<RoomSettings, 'words' | 'spicy' | 'difficulty'>,
): WordEntry[] {
  const languages: WordPack['language'][] =
    settings.words === 'en' ? ['en'] : settings.words === 'taglish' ? ['tl'] : ['en', 'tl'];
  return packs
    .filter((p) => languages.includes(p.language) && (p.rating === 'family' || settings.spicy))
    .flatMap((p) => p.words)
    .filter((w) => settings.difficulty === 'mixed' || w.difficulty === 1);
}

/** Every allowed word, shuffled, with a fresh `usedIds`. */
function reshuffle(allowed: readonly WordEntry[], rng: SeededRng): Deck {
  return { remaining: rng.shuffle(allowed.map((w) => w.id)), usedIds: [] };
}

/**
 * A new game's deck: every allowed word not used yet this session, shuffled. With fewer than
 * `CHOICE_COUNT` of those left it starts over from every allowed word.
 */
export function newDeck(
  allowed: readonly WordEntry[],
  usedIds: readonly string[],
  rng: SeededRng,
): { deck: Deck; reshuffled: boolean } {
  const used = new Set(usedIds);
  const fresh = allowed.filter((w) => !used.has(w.id));
  if (fresh.length < CHOICE_COUNT) return { deck: reshuffle(allowed, rng), reshuffled: true };
  return {
    deck: { remaining: rng.shuffle(fresh.map((w) => w.id)), usedIds: [...usedIds] },
    reshuffled: false,
  };
}

/** The levels to try for each target, nearest first; a tie goes to the easier one. */
const NEAREST: Record<WordEntry['difficulty'], WordEntry['difficulty'][]> = {
  1: [1, 2, 3],
  2: [2, 1, 3],
  3: [3, 2, 1],
};

/**
 * Deals three words off the deck, easiest first: the topmost easy, medium and hard word for
 * 'mixed' (a missing level filled from the nearest one), the top three for 'easy' (an easy deck
 * holds only level 1). When fewer than three are left, the deck is rebuilt from every allowed word
 * and `usedIds` is cleared (`reshuffled`). Throws if fewer than three words are allowed at all:
 * `host:start` refuses that room first.
 */
export function drawChoices(
  deck: Deck,
  allowed: readonly WordEntry[],
  difficulty: RoomSettings['difficulty'],
  rng: SeededRng,
): { deck: Deck; choices: Choices; reshuffled: boolean } {
  if (allowed.length < CHOICE_COUNT)
    throw new RangeError(`need ${CHOICE_COUNT} allowed words, have ${allowed.length}`);
  const byId = new Map(allowed.map((w) => [w.id, w]));
  // Settings can't change mid-game, but a deck must never deal a word they no longer allow.
  let remaining = deck.remaining.filter((id) => byId.has(id));
  let usedIds = deck.usedIds;
  let reshuffled = false;
  if (remaining.length < CHOICE_COUNT) {
    ({ remaining, usedIds } = reshuffle(allowed, rng));
    reshuffled = true;
  }

  const targets: WordEntry['difficulty'][] = difficulty === 'mixed' ? [1, 2, 3] : [1, 1, 1];
  const taken = new Set<number>();
  for (const target of targets) {
    for (const level of NEAREST[target]) {
      const at = remaining.findIndex(
        (id, i) => !taken.has(i) && byId.get(id)!.difficulty === level,
      );
      if (at !== -1) {
        taken.add(at);
        break;
      }
    }
  }
  const choices = [...taken]
    .map((i) => byId.get(remaining[i]!)!)
    .sort((a, b) => a.difficulty - b.difficulty) as Choices;
  return {
    deck: { remaining: remaining.filter((_, i) => !taken.has(i)), usedIds: [...usedIds] },
    choices,
    reshuffled,
  };
}

/** The drawer chose `index`: only that word is used up; the other two go to the bottom. */
export function chooseWord(deck: Deck, choices: Choices, index: ChoiceIndex): Deck {
  return {
    remaining: [...deck.remaining, ...choices.filter((_, i) => i !== index).map((w) => w.id)],
    usedIds: [...deck.usedIds, choices[index].id],
  };
}

/** Nobody chose (a skipped or abandoned CHOOSING): all three go back to the bottom. */
export function returnChoices(deck: Deck, choices: Choices): Deck {
  return {
    remaining: [...deck.remaining, ...choices.map((w) => w.id)],
    usedIds: [...deck.usedIds],
  };
}

/**
 * A dealt turn that is never drawn (an `upcoming` deal discarded, F21): its words go back to the
 * bottom of the deck, and a word already chosen is no longer used up. No deal happens between the
 * choice and the discard, so no reshuffle can have cleared `usedIds` meanwhile.
 */
export function returnDealt(deck: Deck, choices: Choices, chosen: WordEntry | null): Deck {
  if (!chosen) return returnChoices(deck, choices);
  return {
    remaining: [...deck.remaining, chosen.id],
    usedIds: deck.usedIds.filter((id) => id !== chosen.id),
  };
}

/** The auto-pick: the easiest of the three, a custom word counting as medium; ties go first. */
export function easiestIndex(choices: Choices): ChoiceIndex {
  const level = (w: WordEntry) => (w.lang === 'custom' ? 2 : w.difficulty);
  let best: ChoiceIndex = 0;
  for (const i of [1, 2] as const) if (level(choices[i]) < level(choices[best])) best = i;
  return best;
}
