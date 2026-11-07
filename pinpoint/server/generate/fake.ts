// The fake generator (spec: Generation pipeline), plugged in by `GENERATE_FAKE=1` in development and
// used by tests, so generation can be played through with no key, no spend and no network. Its
// writer names only the places `server/generate/fixtures/` knows (so the fake Wikimedia client
// resolves every one), its checker keeps everything, and its sign checker flags a candidate whose
// Commons file name contains "sign". Every usage is zero, so a fake job costs nothing.

import type { Box, PlaceKind } from '#shared/types.js';
import type { Env } from '../env.js';
import { type StreamingClient, createAnthropicClient } from './anthropic.js';
import type { Generator, PlaceChecker, PlaceWriter, SignChecker } from './generator.js';
import { emptyUsage } from './pricing.js';

interface FakeItem {
  name: string;
  country: string;
  enwiki: string;
  fact: string;
}

/** Every place the fixtures can resolve, in the order the fake writer gives them. */
export const FAKE_PLACES: Readonly<Record<PlaceKind, readonly FakeItem[]>> = {
  city: [
    {
      name: 'Osaka',
      country: 'Japan',
      enwiki: 'Osaka',
      fact: 'Its Dōtonbori canal district is famed for giant moving shop signs.',
    },
    {
      name: 'Kyoto',
      country: 'Japan',
      enwiki: 'Kyoto',
      fact: 'Served as the imperial capital for more than a thousand years.',
    },
    {
      name: 'Sapporo',
      country: 'Japan',
      enwiki: 'Sapporo',
      fact: 'Hosted the 1972 Winter Olympics, the first held in Asia.',
    },
  ],
  landmark: [
    {
      name: 'Himeji Castle',
      country: 'Japan',
      enwiki: 'Himeji Castle',
      fact: 'Nicknamed the White Heron for its white plastered walls.',
    },
    {
      name: 'Tokyo Tower',
      country: 'Japan',
      enwiki: 'Tokyo Tower',
      fact: 'Painted white and international orange to meet air-safety rules.',
    },
  ],
};

/** The box the fake writer proposes for a new category: Japan. */
export const FAKE_BOX: Box = { south: 24, west: 122, north: 46, east: 146 };
export const FAKE_EMOJI = '🗾';

export function fakeWriter(): PlaceWriter {
  return {
    write(request) {
      const avoid = new Set(request.avoid.map((name) => name.toLowerCase()));
      const asked = Math.ceil(request.count * 1.25);
      const pick = (kind: PlaceKind) =>
        FAKE_PLACES[kind].filter(({ name }) => !avoid.has(name.toLowerCase())).slice(0, asked);
      return Promise.resolve({
        cities: pick('city'),
        landmarks: pick('landmark'),
        ...(request.first ? { box: FAKE_BOX, emoji: FAKE_EMOJI, labelStyle: 'city' } : {}),
        usage: emptyUsage(),
      });
    },
  };
}

export function fakeChecker(): PlaceChecker {
  return {
    check(items) {
      return Promise.resolve({
        verdicts: items.map(({ id }) => ({
          id,
          verdict: 'ok',
          reason: 'The fake checker keeps every place.',
        })),
        usage: emptyUsage(),
      });
    },
  };
}

export function fakeSignChecker(): SignChecker {
  return {
    check({ commonsFile }) {
      return Promise.resolve({
        flagged: commonsFile.toLowerCase().includes('sign'),
        usage: emptyUsage(),
      });
    },
  };
}

export function fakeGenerator(): Generator {
  return {
    writer: fakeWriter(),
    checker: fakeChecker(),
    signChecker: fakeSignChecker(),
    fake: true,
  };
}

export const GENERATION_OFF_NO_KEY = 'Generation is off: PINPOINT_ANTHROPIC_API_KEY is not set.';

export type GenerationSetup =
  { generator: Generator; off: null } | { generator: null; off: string };

/**
 * The generator the server runs: the fake one under `GENERATE_FAKE=1` (already false in
 * production, see env.ts), else the real one on a client holding PINPOINT_ANTHROPIC_API_KEY, else
 * none, with the reason. `real` builds the writer, checker and sign checker on that client.
 */
export function generatorFor(
  env: Pick<Env, 'generateFake' | 'anthropicApiKey'>,
  real: (client: StreamingClient) => Generator,
): GenerationSetup {
  if (env.generateFake) return { generator: fakeGenerator(), off: null };
  if (env.anthropicApiKey === null) return { generator: null, off: GENERATION_OFF_NO_KEY };
  return { generator: real(createAnthropicClient(env.anthropicApiKey)), off: null };
}
