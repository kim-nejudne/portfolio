// What a generation costs, estimated from the API's token counts (F84; spec: Admin, Generation
// spend). Ported and adapted from Buzzr (buzzer/server/generate/pricing.ts), without web search,
// which Sketchy's checker doesn't use. Every price lives here: change this table when Anthropic's
// prices change. USD per million tokens, from the Claude API price list of 2026-10; a cache write is
// 1.25× input (5-minute cache), a cache read 0.1×.

import type { RequestUsage } from './generator.js';

export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  // Where a refused Sonnet 5.5 request may be served by the server-side fallback.
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

/**
 * The dearest known price per kind of token, so a model missing from the table is never
 * under-charged. The fake generator's model, `fake`, reports no tokens and so costs nothing.
 */
export const UNKNOWN_MODEL_PRICE: ModelPrice = (() => {
  const prices = Object.values(MODEL_PRICES);
  const most = (key: keyof ModelPrice) => Math.max(...prices.map((p) => p[key]));
  return {
    input: most('input'),
    output: most('output'),
    cacheRead: most('cacheRead'),
    cacheWrite: most('cacheWrite'),
  };
})();

/** One request's cost in US dollars. */
export function requestCostUsd(usage: RequestUsage): number {
  // Own keys only: a model named like an Object method must not find one.
  const price = Object.hasOwn(MODEL_PRICES, usage.model)
    ? MODEL_PRICES[usage.model]!
    : UNKNOWN_MODEL_PRICE;
  return (
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite) /
    1_000_000
  );
}

/** A generation's cost: every request it made, the writer's and the checker's. */
export function usageCostUsd(usage: readonly RequestUsage[]): number {
  return usage.reduce((sum, u) => sum + requestCostUsd(u), 0);
}
