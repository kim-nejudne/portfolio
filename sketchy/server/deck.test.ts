import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import type { RoomSettings, WordEntry } from '../shared/types.js';
import {
  allowedWords,
  chooseWord,
  drawChoices,
  easiestIndex,
  newDeck,
  returnChoices,
  returnDealt,
  type Deck,
} from './deck.js';
import { createRng } from './rng.js';
import { EN_PACK, SPICY_PACK, TEST_PACKS, TL_PACK, testPack } from './test/packs.js';

const settings = (s: Partial<RoomSettings> = {}): RoomSettings => ({ ...DEFAULT_SETTINGS, ...s });
const ids = (words: readonly WordEntry[]) => words.map((w) => w.id);
const levels = (words: readonly WordEntry[]) => words.map((w) => w.difficulty);

describe('allowedWords: the settings filter the deck', () => {
  it("'en' keeps English packs only", () => {
    expect(ids(allowedWords(TEST_PACKS, settings({ words: 'en' })))).toEqual(ids(EN_PACK.words));
  });

  it("'taglish' keeps 'tl' packs only", () => {
    expect(ids(allowedWords(TEST_PACKS, settings({ words: 'taglish' })))).toEqual(
      ids(TL_PACK.words),
    );
  });

  it("'mixed' keeps both languages, and family packs only by default", () => {
    expect(ids(allowedWords(TEST_PACKS, settings()))).toEqual([
      ...ids(EN_PACK.words),
      ...ids(TL_PACK.words),
    ]);
  });

  it('spicy adds the spicy packs of the chosen languages', () => {
    expect(ids(allowedWords(TEST_PACKS, settings({ words: 'en', spicy: true })))).toEqual([
      ...ids(EN_PACK.words),
      ...ids(SPICY_PACK.words),
    ]);
    expect(ids(allowedWords(TEST_PACKS, settings({ words: 'taglish', spicy: true })))).toEqual(
      ids(TL_PACK.words),
    );
  });

  it("'easy' difficulty keeps difficulty 1 only", () => {
    const easy = allowedWords(TEST_PACKS, settings({ difficulty: 'easy' }));
    expect(easy.length).toBeGreaterThan(0);
    expect(new Set(levels(easy))).toEqual(new Set([1]));
  });
});

describe('newDeck', () => {
  const allowed = allowedWords(TEST_PACKS, settings());

  it('holds every allowed word not yet used, shuffled by the room RNG', () => {
    const used = [EN_PACK.words[0]!.id, TL_PACK.words[2]!.id];
    const { deck, reshuffled } = newDeck(allowed, used, createRng(1));
    expect(reshuffled).toBe(false);
    expect(deck.usedIds).toEqual(used);
    expect([...deck.remaining].sort()).toEqual(
      ids(allowed)
        .filter((id) => !used.includes(id))
        .sort(),
    );
    expect(deck.remaining).not.toEqual(ids(allowed).filter((id) => !used.includes(id)));
    // Same seed, same deck: the reducer stays deterministic.
    expect(newDeck(allowed, used, createRng(1)).deck).toEqual(deck);
  });

  it('starts over from every allowed word when fewer than 3 are left unused', () => {
    const used = ids(allowed).slice(2);
    const { deck, reshuffled } = newDeck(allowed, used, createRng(1));
    expect(reshuffled).toBe(true);
    expect(deck.usedIds).toEqual([]);
    expect([...deck.remaining].sort()).toEqual(ids(allowed).sort());
  });
});

/** Draws a whole session's worth, always taking choice `pick`. */
function play(deck: Deck, allowed: readonly WordEntry[], turns: number, pick = 0) {
  const rng = createRng(7);
  const chosen: string[] = [];
  let reshuffledAt = -1;
  for (let i = 0; i < turns; i++) {
    const dealt = drawChoices(deck, allowed, 'mixed', rng);
    if (dealt.reshuffled && reshuffledAt === -1) reshuffledAt = i;
    deck = chooseWord(dealt.deck, dealt.choices, pick as 0 | 1 | 2);
    chosen.push(dealt.choices[pick]!.id);
  }
  return { chosen, reshuffledAt, deck };
}

describe('drawChoices', () => {
  const allowed = allowedWords(TEST_PACKS, settings({ words: 'en' }));

  it("deals one easy, one medium and one hard in 'mixed', easiest first", () => {
    const { deck } = newDeck(allowed, [], createRng(3));
    const { choices, deck: after, reshuffled } = drawChoices(deck, allowed, 'mixed', createRng(4));
    expect(levels(choices)).toEqual([1, 2, 3]);
    expect(reshuffled).toBe(false);
    // The three are off the deck until they go back or one is chosen.
    expect(after.remaining).toHaveLength(deck.remaining.length - 3);
    for (const c of choices) expect(after.remaining).not.toContain(c.id);
  });

  it('takes the first word of each level from the top of the deck', () => {
    const { deck } = newDeck(allowed, [], createRng(3));
    const { choices } = drawChoices(deck, allowed, 'mixed', createRng(4));
    const byId = new Map(allowed.map((w) => [w.id, w]));
    for (const c of choices) {
      const firstOfLevel = deck.remaining.find((id) => byId.get(id)!.difficulty === c.difficulty);
      expect(c.id).toBe(firstOfLevel);
    }
  });

  it("deals three easy words in 'easy'", () => {
    const easy = allowedWords(TEST_PACKS, settings({ words: 'en', difficulty: 'easy' }));
    const { deck } = newDeck(easy, [], createRng(3));
    const { choices } = drawChoices(deck, easy, 'easy', createRng(4));
    expect(levels(choices)).toEqual([1, 1, 1]);
    expect(new Set(ids(choices)).size).toBe(3);
  });

  it('fills a missing level from the nearest one', () => {
    const only = (...rows: [string, 1 | 2 | 3][]) => testPack('p', 'en', 'family', rows).words;
    const deal = (words: readonly WordEntry[]) =>
      levels(
        drawChoices(newDeck(words, [], createRng(1)).deck, words, 'mixed', createRng(2)).choices,
      );
    // No hard word: two mediums.
    expect(deal(only(['aaa', 1], ['bbb', 2], ['ccc', 2], ['ddd', 1]))).toEqual([1, 2, 2]);
    // No easy word: two mediums.
    expect(deal(only(['aaa', 3], ['bbb', 2], ['ccc', 2], ['ddd', 3]))).toEqual([2, 2, 3]);
    // No medium word: the easier neighbour first.
    expect(deal(only(['aaa', 1], ['bbb', 3], ['ccc', 1], ['ddd', 3]))).toEqual([1, 1, 3]);
    // One level only.
    expect(deal(only(['aaa', 3], ['bbb', 3], ['ccc', 3]))).toEqual([3, 3, 3]);
  });

  it('never repeats a word until the deck is exhausted, then reshuffles once', () => {
    const { deck } = newDeck(allowed, [], createRng(3));
    // Each turn uses up one word; the other two go back. With 20 words, 18 turns fit.
    const { chosen, reshuffledAt } = play(deck, allowed, 18);
    expect(new Set(chosen).size).toBe(18);
    expect(reshuffledAt).toBe(-1);

    const longer = play(deck, allowed, 19);
    expect(longer.reshuffledAt).toBe(18);
  });

  it('works through every level and choice position without repeats', () => {
    const { deck } = newDeck(allowed, [], createRng(9));
    for (const pick of [0, 1, 2]) {
      const { chosen } = play(deck, allowed, 15, pick);
      expect(new Set(chosen).size, `pick ${pick}`).toBe(15);
    }
  });

  it('clears usedIds and deals from every allowed word on a reshuffle', () => {
    const used = ids(allowed).slice(0, -2);
    const deck: Deck = { remaining: ids(allowed).slice(-2), usedIds: used };
    const dealt = drawChoices(deck, allowed, 'mixed', createRng(5));
    expect(dealt.reshuffled).toBe(true);
    expect(dealt.deck.usedIds).toEqual([]);
    expect(dealt.deck.remaining).toHaveLength(allowed.length - 3);
    expect(levels(dealt.choices)).toEqual([1, 2, 3]);
  });

  it('skips ids that are no longer allowed', () => {
    const deck: Deck = {
      remaining: ['gone/one', ...ids(allowed), 'gone/two'],
      usedIds: [],
    };
    const dealt = drawChoices(deck, allowed, 'mixed', createRng(5));
    expect(dealt.deck.remaining).not.toContain('gone/one');
    expect(dealt.deck.remaining).not.toContain('gone/two');
  });

  it('refuses to deal from fewer than 3 allowed words', () => {
    const two = allowed.slice(0, 2);
    expect(() => drawChoices({ remaining: [], usedIds: [] }, two, 'mixed', createRng(1))).toThrow(
      RangeError,
    );
  });
});

describe('after the choice', () => {
  const allowed = allowedWords(TEST_PACKS, settings({ words: 'en' }));
  const { deck } = newDeck(allowed, [], createRng(3));
  const { choices, deck: dealt } = drawChoices(deck, allowed, 'mixed', createRng(4));

  it('only the chosen word goes into usedIds; the others go to the bottom of the deck', () => {
    const after = chooseWord(dealt, choices, 1);
    expect(after.usedIds).toEqual([choices[1].id]);
    expect(after.remaining).toEqual([...dealt.remaining, choices[0].id, choices[2].id]);
  });

  it('an unchosen deal goes back to the bottom whole', () => {
    const after = returnChoices(dealt, choices);
    expect(after.usedIds).toEqual([]);
    expect(after.remaining).toEqual([...dealt.remaining, ...ids(choices)]);
  });

  it('an undrawn deal goes back whole: unchosen, or chosen and then discarded (F21)', () => {
    expect(returnDealt(dealt, choices, null)).toEqual(returnChoices(dealt, choices));
    const chosen = chooseWord(dealt, choices, 1);
    const back = returnDealt(chosen, choices, choices[1]);
    expect(back.usedIds).toEqual([]);
    expect(back.remaining).toEqual([
      ...dealt.remaining,
      choices[0].id,
      choices[2].id,
      choices[1].id,
    ]);
  });
});

describe('easiestIndex: the auto-pick', () => {
  const [a, b, c] = EN_PACK.words.filter((w) => w.difficulty === 1) as [
    WordEntry,
    WordEntry,
    WordEntry,
  ];
  const at = (d: 1 | 2 | 3, w: WordEntry, lang: WordEntry['lang'] = 'en'): WordEntry => ({
    ...w,
    difficulty: d,
    lang,
  });

  it('picks the lowest difficulty', () => {
    expect(easiestIndex([at(1, a), at(2, b), at(3, c)])).toBe(0);
    expect(easiestIndex([at(3, a), at(2, b), at(1, c)])).toBe(2);
    expect(easiestIndex([at(2, a), at(1, b), at(3, c)])).toBe(1);
  });

  it('takes the first of equally easy words', () => {
    expect(easiestIndex([at(1, a), at(1, b), at(1, c)])).toBe(0);
    expect(easiestIndex([at(3, a), at(2, b), at(2, c)])).toBe(1);
  });

  it('counts a custom word as medium', () => {
    expect(easiestIndex([at(1, a, 'custom'), at(3, b), at(1, c)])).toBe(2);
    expect(easiestIndex([at(3, a), at(1, b, 'custom'), at(2, c)])).toBe(1);
    expect(easiestIndex([at(3, a, 'custom'), at(3, b), at(3, c)])).toBe(0);
    expect(easiestIndex([at(3, a), at(1, b, 'custom'), at(3, c)])).toBe(1);
  });
});
