import { describe, expect, it } from 'vitest';
import { PROFANITY, feedText, feedWords, hasListedWord } from './profanity.js';
import { SLURS } from './slurs.js';

describe('feedWords', () => {
  it('normalises case and marks and splits on anything but letters', () => {
    expect(feedWords('Ñaño, PÁYONG!')).toEqual(['nano', 'payong']);
  });

  it('reads digits and symbols before a letter as look-alike letters', () => {
    expect(feedWords('sh!t')).toEqual(['shit']);
    expect(feedWords('@$$hole')).toEqual(['asshole']);
    expect(feedWords('b1tch')).toEqual(['bitch']);
    expect(feedWords('g4g0')).toEqual(['gago']);
    expect(feedWords('f*ck')).toEqual(['fuck']);
  });

  it('keeps trailing punctuation as punctuation', () => {
    expect(feedWords('hi!')).toEqual(['hi']);
    expect(feedWords('wow!!! $')).toEqual(['wow']);
  });
});

describe('feedText under each guessFeed mode', () => {
  const rude = [
    'fuck',
    'Putangina mo',
    'GAGO',
    'b1tch',
    'sh!t',
    'f u c k',
    'puta ng ina',
    'fuuuuck',
  ];
  const slur = ['faggot', 'r3tard', 'Tsekwa', 'n i g g e r', 'chinks'];
  const clean = [
    'payong',
    'class',
    'bass',
    'leche flan',
    'putahe',
    'cockroach',
    'Negros',
    'shiitake',
    'hi!',
    '100',
    'assassin',
    'analysis',
    'titanic',
    'pussycat',
    'bitcoin',
    'cocktail',
    'shuttlecock',
  ];

  it.each(rude)('shows %j as typed under all, masks it under clean and off', (text) => {
    expect(feedText(text, 'all')).toBe(text);
    expect(feedText(text, 'clean')).toBeNull();
    expect(feedText(text, 'off')).toBeNull();
  });

  it.each(slur)('masks the slur %j under every mode', (text) => {
    expect(feedText(text, 'all')).toBeNull();
    expect(feedText(text, 'clean')).toBeNull();
    expect(feedText(text, 'off')).toBeNull();
  });

  it.each(clean)('leaves the everyday word %j alone under every mode', (text) => {
    expect(feedText(text, 'all')).toBe(text);
    expect(feedText(text, 'clean')).toBe(text);
    expect(feedText(text, 'off')).toBe(text);
  });

  it('masks the whole guess when one of its words is listed', () => {
    expect(feedText('big fat bitch', 'clean')).toBeNull();
    expect(feedText('payong ng gago', 'clean')).toBeNull();
  });
});

describe('hasListedWord', () => {
  it('matches whole words, stems (`stem*`) and parts (`*part*`)', () => {
    const list = ['ass', 'kantot*', '*fuck*'];
    expect(hasListedWord('ass', list)).toBe(true);
    expect(hasListedWord('class', list)).toBe(false);
    expect(hasListedWord('kantutan', list)).toBe(false);
    expect(hasListedWord('kantotan', list)).toBe(true);
    expect(hasListedWord('motherfucking', list)).toBe(true);
  });

  it('cuts repeated letters to two and to one', () => {
    expect(hasListedWord('asssss', ['ass'])).toBe(true);
    expect(hasListedWord('shiiiit', ['shit'])).toBe(true);
    expect(hasListedWord('as', ['ass'])).toBe(false);
  });

  it('is false for a guess with no letters', () => {
    expect(hasListedWord('!!!', PROFANITY)).toBe(false);
    expect(hasListedWord('', SLURS)).toBe(false);
  });

  it('has lists of lowercase letters with optional leading and trailing stars only', () => {
    for (const entry of [...PROFANITY, ...SLURS]) expect(entry).toMatch(/^\*?[a-z]+\*?$/);
    expect(new Set(PROFANITY).size).toBe(PROFANITY.length);
    expect(new Set(SLURS).size).toBe(SLURS.length);
  });
});
