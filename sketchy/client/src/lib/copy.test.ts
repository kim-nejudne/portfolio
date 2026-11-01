import { describe, expect, it } from 'vitest';
import { PRESETS } from '../../../shared/constants.js';
import { COPY, t, type CopyKey } from './copy.js';

const KEYS = Object.keys(COPY) as CopyKey[];

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const emoji = (s: string) => [...s.matchAll(/\p{Extended_Pictographic}/gu)].map((m) => m[0]);

describe('copy', () => {
  it('fills placeholders from the values given, with no language argument', () => {
    expect(t('waitingForHostToStart', { name: 'Mika' })).toBe('Waiting for 👑 Mika to start');
    expect(t('youGotIt', { points: 270 })).toBe('✓ You got it! +270');
  });

  it('fills several placeholders in one string', () => {
    expect(t('settingsSummary', { seconds: 60, cycles: '2 rounds' })).toBe('60 s · 2 rounds');
  });

  it('leaves a placeholder it has no value for, so a missing value is visible', () => {
    expect(t('gotIt')).toBe('{name} got it!');
  });

  it('every string is filled in', () => {
    expect(KEYS.filter((key) => !COPY[key].trim())).toEqual([]);
  });

  it('placeholders are plain words in braces, never half-open', () => {
    const broken = KEYS.filter((key) => {
      const s = COPY[key].replace(/\{\w+\}/g, '');
      return s.includes('{') || s.includes('}');
    });
    expect(broken).toEqual([]);
  });

  it('keeps the emoji the spec puts in its lines, so icons and the crown stay put', () => {
    expect(emoji(COPY.isHostingTapToChange)).toEqual(['👑']);
    expect(emoji(COPY.waitingForHostToStart)).toEqual(['👑']);
    expect(emoji(COPY.howToGuess)).toEqual(['🤫']);
    expect(emoji(COPY.captionFirstTurn)).toEqual(['🤫']);
    expect(emoji(COPY.captionSecondTurn)).toEqual(['🤫']);
    expect(emoji(COPY.keepPluggedIn)).toEqual(['🔌']);
    expect(emoji(COPY.awardSpeedDemon)).toEqual(['⚡']);
    expect(emoji(COPY.awardAlmost)).toEqual(['😅']);
    expect(placeholders(COPY.captionFirstTurn)).toEqual(['name']);
  });

  it('uses the spec’s English lines', () => {
    expect(t('howToDraw')).toBe('1 · One person draws on their phone');
    expect(t('howToGuess')).toBe('2 · Everyone else types guesses 🤫');
    expect(t('howToScore')).toBe('3 · Faster = more points');
    expect(t('captionFirstTurn', { name: 'Mika' })).toBe(
      'Mika is drawing. Everyone else: type your guess on your phone 🤫',
    );
    expect(t('captionSecondTurn').replace(/’/g, "'")).toBe("Type your guess. Don't say it! 🤫");
    expect(t('guessPlaceholder')).toBe('Your guess?');
    expect(t('soClose')).toBe('So close!');
    expect(t('youDrawNext')).toBe('You draw next! Pick a word');
  });

  it('names the awards and the preset in English', () => {
    expect(t('awardSpeedDemon')).toBe('⚡ Speed Demon');
    expect(t('awardSpeedDemonWhy')).toBe('Fastest guess of the night');
    expect(t('awardAlmost')).toBe('😅 Almost!');
    expect(t('awardAlmostWhy')).toBe('Most close guesses');
    expect(t('presetPartyNight')).toBe('Party Night');
    expect(t('presetPartyNight')).toBe(PRESETS.partyNight.label);
    expect(t('presetPartyNightNote')).toBe('About 20 min');
  });

  it('has no Taglish or Tagalog left, and no words or copy setting', () => {
    const tagalog =
      /\b(ng|mo|ko|na|sa|si|ang|mga|lang|ka|naman|hula|nakuha|bilis|malapit|barkada|taglish|tagalog)\b/i;
    expect(KEYS.filter((key) => tagalog.test(key) || tagalog.test(COPY[key]))).toEqual([]);
    expect(
      KEYS.filter((key) =>
        /^(words(En|Taglish|Mixed)|setting(Words|Copy)|opt(English|Taglish))$/.test(key),
      ),
    ).toEqual([]);
  });

  it('uses US spelling', () => {
    const uk =
      /colour|favourite|behaviour|honour|neighbour|flavour|centre|metre|theatre|grey|cancelled|travelled|organis|realis|recognis|apologis|practise|licence|catalogue/i;
    expect(KEYS.filter((key) => uk.test(key) || uk.test(COPY[key]))).toEqual([]);
    expect(t('colors')).toBe('Colors');
  });
});
