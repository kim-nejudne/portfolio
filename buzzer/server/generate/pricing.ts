// What a generation costs, estimated from the API's usage counts (F109). Every price lives here:
// change this table when Anthropic's prices change. USD per million tokens, from the Claude API
// price list of 2026-10; a cache write is 1.25× input (5-minute cache), a cache read 0.1×.

import type { GenerateUsage } from '../../shared/types.js';

/** Token counts and searches for one or more requests, with their estimated cost. */
export type Usage = GenerateUsage;

interface ModelPrice {
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

/** Web search is billed per search, on top of tokens. */
export const WEB_SEARCH_USD_PER_SEARCH = 10 / 1000;

/** The most expensive known model, so an unknown model is never under-estimated. */
const UNKNOWN_MODEL_PRICE: ModelPrice = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 };

export function emptyUsage(): Usage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    searches: 0,
    costUsd: 0,
  };
}

/** The usage of one request on `model`, priced. */
export function pricedUsage(model: string, counts: Omit<Usage, 'costUsd'>): Usage {
  const price = MODEL_PRICES[model] ?? UNKNOWN_MODEL_PRICE;
  const tokens =
    counts.inputTokens * price.input +
    counts.outputTokens * price.output +
    counts.cacheReadTokens * price.cacheRead +
    counts.cacheWriteTokens * price.cacheWrite;
  return {
    ...counts,
    costUsd: tokens / 1_000_000 + counts.searches * WEB_SEARCH_USD_PER_SEARCH,
  };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    searches: a.searches + b.searches,
    costUsd: a.costUsd + b.costUsd,
  };
}

/** "$0.0123": cents and below stay visible for a cheap level. */
export function formatUsd(usd: number): string {
  return `$${usd.toFixed(4)}`;
}
