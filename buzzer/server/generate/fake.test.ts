import { describe, expect, it } from 'vitest';
import { emptyUsage } from './pricing.js';
import type { LevelRequest, LevelStage } from './generator.js';
import { GenerationCancelled, GenerationError } from './generator.js';
import { fakeGenerator, generatorFor } from './fake.js';
import type { GenerateLevelFn } from './jobs.js';

const request = (overrides: Partial<LevelRequest> = {}): LevelRequest => ({
  category: 'Moons',
  guidance: '',
  difficulty: 'easy',
  count: 5,
  avoid: [],
  ...overrides,
});

function run(req: LevelRequest) {
  const waits: number[] = [];
  const stages: LevelStage[] = [];
  const generate = fakeGenerator({
    stepMs: 7,
    wait: async (ms) => {
      waits.push(ms);
    },
  });
  return { result: generate(req, (stage) => stages.push(stage)), stages, waits };
}

describe('fakeGenerator (GENERATE_FAKE=1)', () => {
  it('goes through writing and checking, waiting a step in each, and writes the count asked for', async () => {
    const { result, stages, waits } = run(request());
    const level = await result;
    expect(stages).toEqual(['writing', 'checking']);
    expect(waits).toEqual([7, 7]);
    expect(level.short).toBe(false);
    expect(level.questions).toHaveLength(5);
    expect(level.questions[0]).toEqual({ text: 'Moons Easy question 1?', answer: 'Answer 1' });
    expect(level.usage.costUsd).toBeGreaterThan(0);
  });

  it('numbers past the questions to avoid, so it never repeats them', async () => {
    const level = await run(request({ avoid: ['a', 'b'], difficulty: 'hard' })).result;
    expect(level.questions[0]!.text).toBe('Moons Hard question 3?');
  });

  it('comes back two short for a category named "short"', async () => {
    const level = await run(request({ category: 'Short Rivers', count: 15 })).result;
    expect(level).toMatchObject({ short: true });
    expect(level.questions).toHaveLength(13);
  });

  it('writes one question for a replacement, never one already in its level (F113)', async () => {
    // Question 3 was replaced by 6 earlier, so the level holds 1, 2, 6, 4, 5.
    const avoid = [1, 2, 6, 4, 5].map((n) => `Moons Easy question ${n}?`);
    const level = await run(request({ count: 1, avoid })).result;
    expect(level.questions).toEqual([{ text: 'Moons Easy question 7?', answer: 'Answer 7' }]);
  });

  it('stops after the step it is in once cancelled (F113)', async () => {
    const controller = new AbortController();
    const stages: LevelStage[] = [];
    const generate = fakeGenerator({
      stepMs: 1,
      wait: async () => {
        controller.abort();
      },
    });
    await expect(
      generate(request(), (stage) => stages.push(stage), controller.signal),
    ).rejects.toBeInstanceOf(GenerationCancelled);
    expect(stages).toEqual(['writing']);
  });

  it('fails a category named "fail" with a GenerationError', async () => {
    await expect(run(request({ category: 'Will FAIL' })).result).rejects.toBeInstanceOf(
      GenerationError,
    );
  });
});

describe('generatorFor', () => {
  const fake: GenerateLevelFn = async () => ({ questions: [], short: false, usage: emptyUsage() });
  const real: GenerateLevelFn = async () => ({ questions: [], short: true, usage: emptyUsage() });
  const keys: string[] = [];
  const make = {
    fake: () => fake,
    real: (key: string) => {
      keys.push(key);
      return real;
    },
  };

  it('is the fake one when GENERATE_FAKE is on, even with a key, and never builds the real client', () => {
    keys.length = 0;
    expect(generatorFor({ fake: true, key: 'sk-test' }, make)).toBe(fake);
    expect(keys).toEqual([]);
  });

  it('is the real one with the key when the fake is off', () => {
    keys.length = 0;
    expect(generatorFor({ fake: false, key: 'sk-test' }, make)).toBe(real);
    expect(keys).toEqual(['sk-test']);
  });

  it('is none, so generation is off, with neither', () => {
    expect(generatorFor({ fake: false, key: null }, make)).toBeNull();
  });
});
