import { describe, expect, it } from 'vitest';
import { SAMPLE_FLAG_ID, SAMPLE_HEXAGON_ID, SAMPLE_SET } from './sampleSet.js';
import { createRoomBodySchema, questionSetSchema } from './schemas.js';
import { DEFAULT_SETTINGS } from './constants.js';

describe('SAMPLE_SET', () => {
  it('is a valid question set with 10 questions', () => {
    expect(questionSetSchema.parse(SAMPLE_SET)).toEqual(SAMPLE_SET);
    expect(SAMPLE_SET.questions).toHaveLength(10);
  });

  it('can create a room as-is with the default settings', () => {
    expect(
      createRoomBodySchema.safeParse({ set: SAMPLE_SET, settings: DEFAULT_SETTINGS }).success,
    ).toBe(true);
  });

  it('has 2 picture questions, one of them image-only', () => {
    const pictures = SAMPLE_SET.questions.filter((q) => q.imageId !== undefined);
    expect(pictures.map((q) => [q.imageId, q.text === ''])).toEqual([
      [SAMPLE_HEXAGON_ID, false],
      [SAMPLE_FLAG_ID, true],
    ]);
  });
});
