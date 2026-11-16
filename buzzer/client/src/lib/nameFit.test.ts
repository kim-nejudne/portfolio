import { describe, expect, it } from 'vitest';
import { PLAYER_NAME_MAX } from '../../../shared/constants.js';
import { BANNER_NAME, PODIUM_NAME, nameFitSize } from './nameFit.js';

/** The ems in the `calc(100cqw / N)` term. */
const ems = (size: string) => Number(/100cqw \/ ([\d.]+)/.exec(size)![1]);

describe('nameFitSize (F153)', () => {
  it('caps at the inherited size and fits the container, above the floor', () => {
    expect(nameFitSize('Ana Revilla', BANNER_NAME)).toMatch(
      /^max\(var\(--screen-min-name\), min\(1em, calc\(100cqw \/ [\d.]+\)\)\)$/,
    );
  });

  it('gives the banner a whole line: every character and the dot', () => {
    expect(ems(nameFitSize('Bartholomew Quin', BANNER_NAME))).toBeCloseTo(16 * 1.05 + 0.8);
    expect(ems(nameFitSize('Cy', BANNER_NAME))).toBeCloseTo(2 * 1.05 + 0.8);
  });

  it('gives a podium name its longest word, since it may wrap at a space', () => {
    expect(ems(nameFitSize('Bartholomew Quin', PODIUM_NAME))).toBeCloseTo(11 * 0.62 + 1.7);
    expect(ems(nameFitSize('Ana Revilla', PODIUM_NAME))).toBeCloseTo(7 * 0.62 + 1.7);
  });

  it('leaves room for an avatar', () => {
    expect(
      ems(nameFitSize('Cy', PODIUM_NAME, true)) - ems(nameFitSize('Cy', PODIUM_NAME)),
    ).toBeCloseTo(1.3);
  });

  it('only steps down as a name grows, up to the longest name', () => {
    const sizes = Array.from({ length: PLAYER_NAME_MAX }, (_, i) =>
      ems(nameFitSize('W'.repeat(i + 1), BANNER_NAME)),
    );
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });
});
