import { describe, expect, it } from 'vitest';
import { COPY_LANGUAGES } from '../../../shared/constants.js';
import { COPY_TABLES, translator, type CopyKey } from './copy.js';

const EN = COPY_TABLES.en;
const TAGLISH = COPY_TABLES.taglish;
const KEYS = Object.keys(EN) as CopyKey[];

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const emoji = (s: string) => [...s.matchAll(/\p{Extended_Pictographic}/gu)].map((m) => m[0]).sort();
// The spec writes "Sino'ng"; the tables use the typographic apostrophe.
const plain = (s: string) => s.replace(/’/g, "'");

describe('copy', () => {
  it('fills placeholders from the values given', () => {
    expect(translator('en')('waitingForHostToStart', { name: 'Mika' })).toBe(
      'Waiting for 👑 Mika to start',
    );
  });

  it('leaves a placeholder it has no value for, so a missing value is visible', () => {
    expect(translator('en')('gotIt')).toBe('{name} got it!');
  });

  it('has a table for every copy setting', () => {
    expect(Object.keys(COPY_TABLES).sort()).toEqual([...COPY_LANGUAGES].sort());
  });

  it('both tables have the same keys', () => {
    expect(Object.keys(TAGLISH).sort()).toEqual([...KEYS].sort());
  });

  it('every Taglish string is filled in', () => {
    const empty = KEYS.filter((key) => !TAGLISH[key]?.trim());
    expect(empty).toEqual([]);
  });

  it('each Taglish string takes the same placeholders as the English one', () => {
    const differ = KEYS.filter(
      (key) => placeholders(EN[key]).join() !== placeholders(TAGLISH[key]).join(),
    );
    expect(differ).toEqual([]);
  });

  it('each Taglish string keeps the English one’s emoji, so icons and the crown stay put', () => {
    const differ = KEYS.filter((key) => emoji(EN[key]).join() !== emoji(TAGLISH[key]).join());
    expect(differ).toEqual([]);
  });

  it('uses the spec’s Taglish lines', () => {
    const t = translator('taglish');
    expect(t('yourTurnToDraw')).toBe('Ikaw ang magdo-drawing!');
    expect(t('youDrawNext')).toContain('Pili ka ng word');
    expect(t('guessPlaceholder')).toBe('Hula mo?');
    expect(t('soClose')).toBe('Malapit na!');
    expect(t('youGotIt', { points: 300 })).toBe('✓ Nakuha mo! +300');
    expect(plain(t('gotItLabel'))).toBe("Sino'ng nakakuha?");
    expect(plain(t('captionSecondTurn'))).toBe("I-type, 'wag isigaw! 🤫");
    expect(t('nobodyGotIt')).toBe('Walang nakakuha!');
  });

  it('switches the How to play strip, captions and awards to Taglish', () => {
    const en = translator('en');
    const tl = translator('taglish');
    const keys: CopyKey[] = [
      'howToPlay',
      'howToDraw',
      'howToGuess',
      'howToScore',
      'captionFirstTurn',
      'captionSecondTurn',
      'awardsTitle',
      'awardPicassoWhy',
      'awardBilisWhy',
      'awardSharpshooterWhy',
      'awardMalapitNaWhy',
      'awardMostCreativeWhy',
      'awardModernArtWhy',
    ];
    const same = keys.filter((key) => en(key, { name: 'Mika' }) === tl(key, { name: 'Mika' }));
    expect(same).toEqual([]);
    expect(tl('captionFirstTurn', { name: 'Mika' })).toBe(
      'Nagdo-drawing si Mika. Kayong iba: i-type ang hula sa phone 🤫',
    );
  });
});
