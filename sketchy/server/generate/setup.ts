// Word generation's start-up (F83). Ported and adapted from Buzzr (buzzer/server/generate/setup.ts):
// one variable, SKETCHY_ANTHROPIC_API_KEY, and no other. With it, Claude writes and checks; without
// it, development (NODE_ENV=development only) gets the fake generator, and anything else has
// generation off. One line is logged
// saying which. The key goes to the SDK client and nowhere else.

import { GENERATE_KEY_VAR } from '../../shared/constants.js';
import type { AdminGenerateMode } from '../../shared/types.js';
import { parseAnthropicApiKey } from '../env.js';
import { anthropicGenerator, type GenerateFn } from './jobs.js';
import { createAnthropicClient } from './client.js';
import { fakeGenerator } from './fake.js';

export interface GenerationLog {
  log(message: string): void;
}

export interface GenerationSetup {
  /** Null when generation is off. */
  generate: GenerateFn | null;
  mode: AdminGenerateMode;
}

export const GENERATION_OFF = `Generation is off: the server has no ${GENERATE_KEY_VAR}.`;

export function setUpGeneration(
  env: { [GENERATE_KEY_VAR]?: string },
  development: boolean,
  out: GenerationLog = console,
  make: { fake: () => GenerateFn; real: (key: string) => GenerateFn } = {
    fake: () => fakeGenerator(),
    real: (key) => anthropicGenerator(createAnthropicClient(key)),
  },
): GenerationSetup {
  const key = parseAnthropicApiKey(env[GENERATE_KEY_VAR]);
  if (key !== null) {
    out.log('Word generation: on (Claude).');
    return { generate: make.real(key), mode: 'claude' };
  }
  if (development) {
    out.log(`Word generation: the fake generator (no ${GENERATE_KEY_VAR}; nothing is spent).`);
    return { generate: make.fake(), mode: 'fake' };
  }
  out.log(`Word generation: off (no ${GENERATE_KEY_VAR}).`);
  return { generate: null, mode: 'off' };
}
