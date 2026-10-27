import { describe, expect, it } from 'vitest';
import { SAMPLE_SET } from './sampleSet.js';
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

  it('is text only until images arrive in F30', () => {
    expect(SAMPLE_SET.questions.every((q) => q.text.length > 0 && q.imageId === undefined)).toBe(
      true,
    );
  });
});
