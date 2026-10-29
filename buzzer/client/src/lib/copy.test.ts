import { describe, expect, it } from 'vitest';
import { COPY_LANGUAGES } from '../../../shared/constants.js';
import {
  COPY_TABLES,
  copyLanguage,
  placeholders,
  pointsText,
  rankText,
  translator,
} from './copy.js';

describe('copy tables', () => {
  const en = COPY_TABLES.en;

  it('has a table for every language the settings offer', () => {
    expect(Object.keys(COPY_TABLES).sort()).toEqual([...COPY_LANGUAGES].sort());
  });

  it('gives English and Taglish the same keys', () => {
    for (const language of COPY_LANGUAGES) {
      expect(Object.keys(COPY_TABLES[language]).sort(), language).toEqual(Object.keys(en).sort());
    }
  });

  it('has no empty or blank string in either table', () => {
    for (const language of COPY_LANGUAGES) {
      for (const [key, text] of Object.entries(COPY_TABLES[language])) {
        expect(text.trim(), `${language}.${key}`).not.toBe('');
      }
    }
  });

  it('uses the same placeholders in both tables, so no value goes missing', () => {
    for (const [key, text] of Object.entries(en)) {
      expect(placeholders(COPY_TABLES.taglish[key as keyof typeof en]), key).toEqual(
        placeholders(text),
      );
    }
  });
});

describe('translator', () => {
  it('fills the placeholders in either language', () => {
    expect(translator('en')('questionOf', { n: 3, count: 10 })).toBe('Question 3 of 10');
    expect(translator('taglish')('questionOf', { n: 3, count: 10 })).toBe('Tanong 3 sa 10');
    expect(translator('taglish')('buzzedFirst', { name: 'Ana' })).toBe('Si Ana ang unang nag-buzz');
  });

  it('leaves a placeholder with no value as written', () => {
    expect(translator('en')('buzzedFirst')).toBe('{name} buzzed first');
  });

  it('counts points with their unit, and ranks with English ordinals', () => {
    expect(pointsText(translator('en'), 1)).toBe('1 point');
    expect(pointsText(translator('en'), 250)).toBe('250 points');
    expect(pointsText(translator('taglish'), 250)).toBe('250 puntos');
    expect(rankText(translator('en'), 3, 8)).toBe('3rd of 8');
    expect(rankText(translator('taglish'), 3, 8)).toBe('3rd sa 8');
  });
});

describe('copyLanguage', () => {
  it('reads the phone’s and the Screen’s language, and keeps the host remote English', () => {
    expect(copyLanguage(null)).toBe('en');
    expect(copyLanguage({ role: 'player', copy: 'taglish' } as never)).toBe('taglish');
    expect(copyLanguage({ role: 'screen', settings: { copy: 'taglish' } } as never)).toBe(
      'taglish',
    );
    expect(copyLanguage({ role: 'host', settings: { copy: 'taglish' } } as never)).toBe('en');
  });
});
