// Pricing (F84): each request's token counts priced by its model; an unknown model at the dearest
// known price, never under-charged; the fake generator free.
import { describe, expect, it } from 'vitest';
import { formatUsd } from '../../shared/constants.js';
import { FAKE_MODEL } from './fake.js';
import type { RequestUsage } from './generator.js';
import { MODEL_PRICES, requestCostUsd, UNKNOWN_MODEL_PRICE, usageCostUsd } from './pricing.js';

const usage = (model: string, over: Partial<RequestUsage> = {}): RequestUsage => ({
  model,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  ...over,
});

const MILLION = {
  inputTokens: 1e6,
  outputTokens: 1e6,
  cacheReadTokens: 1e6,
  cacheWriteTokens: 1e6,
};

describe('pricing', () => {
  it('prices Sonnet 5.5 and Haiku 5.5 per million tokens of each kind', () => {
    expect(requestCostUsd(usage('claude-sonnet-5-5', { inputTokens: 1e6 }))).toBeCloseTo(2);
    expect(requestCostUsd(usage('claude-sonnet-5-5', { outputTokens: 1e6 }))).toBeCloseTo(10);
    expect(requestCostUsd(usage('claude-sonnet-5-5', { cacheReadTokens: 1e6 }))).toBeCloseTo(0.2);
    expect(requestCostUsd(usage('claude-sonnet-5-5', { cacheWriteTokens: 1e6 }))).toBeCloseTo(2.5);
    expect(requestCostUsd(usage('claude-haiku-5-5', MILLION))).toBeCloseTo(
      0.1 + 0.5 + 0.01 + 0.125,
    );
  });

  it('a typical generation: Sonnet writes, Haiku checks, summed', () => {
    const cost = usageCostUsd([
      usage('claude-sonnet-5-5', {
        inputTokens: 1_800,
        outputTokens: 6_000,
        cacheWriteTokens: 900,
      }),
      usage('claude-haiku-5-5', { inputTokens: 2_500, outputTokens: 1_500 }),
    ]);
    // 1800×2 + 6000×10 + 900×2.5 = 65 850; 2500×0.1 + 1500×0.5 = 1000; per million.
    expect(cost).toBeCloseTo(0.06685, 8);
    expect(formatUsd(cost)).toBe('$0.0669');
  });

  it('charges an unknown model at the dearest known price of each kind', () => {
    for (const key of ['input', 'output', 'cacheRead', 'cacheWrite'] as const) {
      expect(UNKNOWN_MODEL_PRICE[key]).toBe(
        Math.max(...Object.values(MODEL_PRICES).map((p) => p[key])),
      );
    }
    expect(requestCostUsd(usage('claude-future-9', MILLION))).toBeCloseTo(
      requestCostUsd(usage('claude-sonnet-5-5', MILLION)),
    );
    // Not an Object method's name either.
    expect(requestCostUsd(usage('constructor', { outputTokens: 1e6 }))).toBeCloseTo(10);
  });

  it('the fake generator costs nothing', () => {
    expect(usageCostUsd([usage(FAKE_MODEL), usage(FAKE_MODEL)])).toBe(0);
    expect(usageCostUsd([])).toBe(0);
  });

  it('formats under a dollar to 4 places and from a dollar up to 2', () => {
    expect(formatUsd(0)).toBe('$0.0000');
    expect(formatUsd(0.0042)).toBe('$0.0042');
    expect(formatUsd(5)).toBe('$5.00');
    expect(formatUsd(12.346)).toBe('$12.35');
  });
});
