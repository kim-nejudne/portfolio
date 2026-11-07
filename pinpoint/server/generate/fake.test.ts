import { afterEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { FACT_MAX } from '#shared/constants.js';
import { createFakeWikimediaClient } from './fakeWikimedia.js';
import {
  FAKE_BOX,
  FAKE_PLACES,
  GENERATION_OFF_NO_KEY,
  fakeChecker,
  fakeGenerator,
  fakeSignChecker,
  fakeWriter,
  generatorFor,
} from './fake.js';
import type { CheckItem, WriteRequest } from './generator.js';
import { createResolver } from './resolver.js';

const REQUEST: WriteRequest = {
  category: 'Japan',
  guidance: '',
  level: 'easy',
  box: null,
  count: 5,
  avoid: [],
  first: false,
};

describe('the fake generator', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('writes the fixture places, skipping the avoid list, at no cost', async () => {
    const out = await fakeWriter().write({ ...REQUEST, avoid: ['kyoto'] });
    expect(out.cities).toEqual([FAKE_PLACES.city[0], FAKE_PLACES.city[2]]);
    expect(out.landmarks).toEqual(FAKE_PLACES.landmark);
    expect(out.usage.costUsd).toBe(0);
    expect(out).not.toHaveProperty('box');
    const capped = await fakeWriter().write({ ...REQUEST, count: 1 }); // ceil(1.25) = 2
    expect(capped.cities).toHaveLength(2);
  });

  it('proposes a box, emoji and label style only on a first level', async () => {
    const out = await fakeWriter().write({ ...REQUEST, first: true });
    expect(out).toMatchObject({ box: FAKE_BOX, emoji: '🗾', labelStyle: 'city' });
  });

  it('writes only places the fake Wikimedia client resolves, with facts in bounds', async () => {
    const resolver = createResolver(createFakeWikimediaClient());
    for (const kind of ['city', 'landmark'] as const) {
      for (const item of FAKE_PLACES[kind]) {
        expect(item.fact.length).toBeLessThanOrEqual(FACT_MAX);
        const out = await resolver.resolve(item, {
          kind,
          box: FAKE_BOX,
          labelStyle: 'city',
          existingIds: new Set(),
        });
        expect(out, item.name).toHaveProperty('place');
      }
    }
  });

  it('keeps every place it checks', async () => {
    const items = [{ id: 'a' }, { id: 'b' }] as CheckItem[];
    const out = await fakeChecker().check(items, { level: 'easy', maxSearches: 10 });
    expect(out.verdicts).toEqual([
      expect.objectContaining({ id: 'a', verdict: 'ok' }),
      expect.objectContaining({ id: 'b', verdict: 'ok' }),
    ]);
  });

  it('flags a photo whose file name contains "sign"', async () => {
    const check = (commonsFile: string) =>
      fakeSignChecker().check({
        commonsFile,
        image: new Uint8Array(),
        mediaType: 'image/jpeg',
        name: 'Tokyo Tower',
        country: 'Japan',
      });
    expect((await check('File:Tokyo Tower sign at entrance.jpg')).flagged).toBe(true);
    expect((await check('File:Tokyo Tower 2023.jpg')).flagged).toBe(false);
  });

  it('is what GENERATE_FAKE=1 runs, with or without a key', () => {
    const real = vi.fn();
    const setup = generatorFor({ generateFake: true, anthropicApiKey: 'sk-ant-x' }, real);
    expect(setup.off).toBeNull();
    expect(setup.generator?.fake).toBe(true);
    expect(real).not.toHaveBeenCalled();
  });

  it('turns generation off, with its reason, when the key is unset, even with ANTHROPIC_API_KEY', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-from-the-cli');
    const real = vi.fn();
    expect(generatorFor({ generateFake: false, anthropicApiKey: null }, real)).toEqual({
      generator: null,
      off: GENERATION_OFF_NO_KEY,
    });
    expect(real).not.toHaveBeenCalled();
  });

  it('builds the real generator on a client holding PINPOINT_ANTHROPIC_API_KEY', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-from-the-cli');
    const generator = { ...fakeGenerator(), fake: false };
    const real = vi.fn(() => generator);
    const setup = generatorFor({ generateFake: false, anthropicApiKey: 'sk-ant-pinpoint' }, real);
    expect(setup).toEqual({ generator, off: null });
    expect((real.mock.calls[0] as unknown as [Anthropic])[0].apiKey).toBe('sk-ant-pinpoint');
  });
});
