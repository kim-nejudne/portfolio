// The question generator's start-up (F112): reads its three variables, picks the generator and
// logs one line saying which. The key goes to the SDK client and nowhere else: no line here
// prints it, and `setup.test.ts` checks that for every combination.

import { parseAnthropicApiKey, parseGenerateDailyLimit, parseGenerateFake } from '../env.js';
import { createAnthropicClient } from './client.js';
import { fakeGenerator, generatorFor } from './fake.js';
import { anthropicGenerator, type GenerateLevelFn } from './jobs.js';

export interface GenerationEnv {
  BUZZR_ANTHROPIC_API_KEY?: string;
  GENERATE_DAILY_LIMIT?: string;
  GENERATE_FAKE?: string;
}

export interface GenerationLog {
  log(message: string): void;
  warn(message: string): void;
}

export interface GenerationSetup {
  /** Null when generation is off. */
  generate: GenerateLevelFn | null;
  dailyLimit: number;
}

export const GENERATE_FAKE_REFUSED = 'GENERATE_FAKE is ignored in production.';

export function setUpGeneration(
  env: GenerationEnv,
  production: boolean,
  out: GenerationLog = console,
  make: { fake: () => GenerateLevelFn; real: (key: string) => GenerateLevelFn } = {
    fake: () => fakeGenerator(),
    real: (key) => anthropicGenerator(createAnthropicClient(key)),
  },
): GenerationSetup {
  const key = parseAnthropicApiKey(env.BUZZR_ANTHROPIC_API_KEY);
  const dailyLimit = parseGenerateDailyLimit(env.GENERATE_DAILY_LIMIT);
  // Refused in production, so a stray variable can never fill the live built-ins with fake questions.
  const fake = parseGenerateFake(env.GENERATE_FAKE, production);
  if (production && env.GENERATE_FAKE !== undefined) out.warn(GENERATE_FAKE_REFUSED);
  const generate = generatorFor({ fake, key }, make);
  if (fake) out.log('GENERATE_FAKE=1: the question generator is the fake one.');
  else if (generate !== null) {
    out.log(`Question generator: on, at most ${dailyLimit} levels a day (UTC).`);
  } else out.log('Question generator: off (no BUZZR_ANTHROPIC_API_KEY).');
  return { generate, dailyLimit };
}
