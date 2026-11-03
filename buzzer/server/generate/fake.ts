// A stand-in for the real generator (F111), plugged in by `GENERATE_FAKE=1` in development only,
// so the admin dashboard can be played through with no API key and no spend. It waits `stepMs`
// in each stage so the progress shows, and writes plain numbered questions. A category whose name
// holds "fail" fails its level; one that holds "short" comes back two questions short. A cancel
// (F113) stops it after the step it is in, as the real one stops after its current API call.
// Asked for an emoji (F129), it gives 🎯.

import { DIFFICULTY_LABELS } from '../../shared/constants.js';
import { GenerationCancelled, GenerationError } from './generator.js';
import type { GenerateLevelFn } from './jobs.js';
import { emptyUsage } from './pricing.js';

/** How many questions short a "short" category comes back. */
const SHORT_BY = 2;

export function fakeGenerator({
  stepMs = 1500,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: { stepMs?: number; wait?: (ms: number) => Promise<void> } = {}): GenerateLevelFn {
  return async (request, onStage, signal) => {
    const name = request.category.toLowerCase();
    const usage = { ...emptyUsage(), inputTokens: 1000, outputTokens: 500, costUsd: 0.01 };
    const step = async (stage: 'writing' | 'checking') => {
      if (signal?.aborted) throw new GenerationCancelled(usage);
      onStage(stage);
      await wait(stepMs);
    };
    await step('writing');
    await step('checking');
    if (signal?.aborted) throw new GenerationCancelled(usage);
    if (name.includes('fail')) {
      throw new GenerationError('The fake generator fails every category named “fail”.');
    }
    const short = name.includes('short');
    const count = short ? Math.max(1, request.count - SHORT_BY) : request.count;
    const label = DIFFICULTY_LABELS[request.difficulty];
    // Numbered past the questions already in the category, skipping any number already taken, so
    // a regenerate or a replacement (whose avoid list is its level) never repeats one.
    const taken = new Set(request.avoid);
    const questions = [];
    for (let n = request.avoid.length + 1; questions.length < count; n++) {
      const text = `${request.category} ${label} question ${n}?`;
      if (!taken.has(text)) questions.push({ text, answer: `Answer ${n}` });
    }
    // Asked for the category's emoji, it always suggests 🎯 (F129).
    return { questions, short, usage, ...(request.wantEmoji === true ? { emoji: '🎯' } : {}) };
  };
}

/**
 * The generator the server runs: the fake one when `GENERATE_FAKE` is on (already false in
 * production, see `parseGenerateFake`), else the real one when there is a key, else none
 * (generation off).
 */
export function generatorFor(
  { fake, key }: { fake: boolean; key: string | null },
  make: { fake: () => GenerateLevelFn; real: (key: string) => GenerateLevelFn },
): GenerateLevelFn | null {
  if (fake) return make.fake();
  return key === null ? null : make.real(key);
}
