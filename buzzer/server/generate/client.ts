// The one place that builds an Anthropic SDK client (F109). The key comes only from
// BUZZR_ANTHROPIC_API_KEY (`parseAnthropicApiKey` in env.ts) and is passed explicitly: the SDK
// constructor with no options would fall back to ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an
// `ant` profile on the machine (DECISIONS F108–F112).

import Anthropic from '@anthropic-ai/sdk';
import type { StreamingClient } from './anthropic.js';

const API_BASE_URL = 'https://api.anthropic.com';
/** Retries on 408, 409, 429 and 5xx (529 included), with the SDK's backoff. */
const MAX_RETRIES = 3;

export function createAnthropicClient(apiKey: string): Anthropic & StreamingClient {
  return new Anthropic({
    apiKey,
    // Explicit, so ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL in the environment are ignored.
    authToken: null,
    baseURL: API_BASE_URL,
    maxRetries: MAX_RETRIES,
  });
}
