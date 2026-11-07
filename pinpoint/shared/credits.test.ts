import { describe, expect, it } from 'vitest';
import { guessingCredit } from '#shared/credits.js';

const place = { name: 'Fushimi Inari-taisha', displayName: 'Fushimi Inari', countryName: 'Japan' };
const credit = (author: string, p = place) => guessingCredit({ author, licence: 'CC BY 4.0' }, p);
const HIDDEN = 'Photo: Wikimedia Commons contributor · CC BY 4.0';

describe('guessingCredit', () => {
  it('shows an author who shares no 4+ letter word with the answer', () => {
    expect(credit('Jane Doe')).toBe('Photo: Jane Doe · CC BY 4.0');
  });

  it('hides an author containing a word of the name, display name or country', () => {
    expect(credit('Fushimi Fan Club')).toBe(HIDDEN); // name and display name
    expect(credit('taisha-lover')).toBe(HIDDEN); // a word after the hyphen
    expect(credit('JAPANESE photographer')).toBe(HIDDEN); // country, inside a longer word
  });

  it('ignores case and accents on both sides', () => {
    expect(credit('Kyōto Walker', { ...place, name: 'Kyoto Tower' })).toBe(HIDDEN);
    expect(credit('kyoto walker', { ...place, name: 'Kyōto Tower' })).toBe(HIDDEN);
    expect(
      credit('Musée fan', { name: 'Le Musee', displayName: 'Le Musee', countryName: 'France' }),
    ).toBe(HIDDEN);
  });

  it('counts only words of 4 or more letters', () => {
    const tower = { name: 'Big Ben', displayName: 'Big Ben', countryName: 'UK' };
    expect(credit('Big Al', tower)).toBe('Photo: Big Al · CC BY 4.0');
    expect(credit('Benny', tower)).toBe('Photo: Benny · CC BY 4.0');
    expect(credit('Inar', place)).toBe('Photo: Inar · CC BY 4.0'); // "Inari" is not in "Inar"
  });
});
