// The big rank on the phone's scoreboard and final (F61): 1st, 2nd, 3rd, then th, with 11–13th.
import { describe, expect, it } from 'vitest';
import { ordinalSuffix } from './ordinal.js';

describe('ordinalSuffix', () => {
  it('writes st, nd, rd and th like English ordinals, 11th to 13th included', () => {
    const got = [1, 2, 3, 4, 9, 10, 11, 12, 13, 14, 21, 22, 23, 101, 111, 112].map(
      (n) => `${n}${ordinalSuffix(n)}`,
    );
    expect(got).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '9th',
      '10th',
      '11th',
      '12th',
      '13th',
      '14th',
      '21st',
      '22nd',
      '23rd',
      '101st',
      '111th',
      '112th',
    ]);
  });
});
