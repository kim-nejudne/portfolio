// The one place that builds an Anthropic SDK client (F83). Ported from Buzzr
// (buzzer/server/generate/client.ts). The key comes only from SKETCHY_ANTHROPIC_API_KEY
// (`parseAnthropicApiKey` in env.ts) and is passed explicitly: the SDK constructor with no options
// would fall back to ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant` profile on the machine.

import Anthropic from '@anthropic-ai/sdk';
import { GENERATE_REQUEST_TIMEOUT_MS } from '../../shared/constants.js';
import type { StreamingClient } from './anthropic.js';

const API_BASE_URL = 'https://api.anthropic.com';
/** Retries on 408, 409, 429 and 5xx (529 included), with the SDK's backoff. */
const MAX_RETRIES = 2;

export function createAnthropicClient(apiKey: string): Anthropic & StreamingClient {
  return new Anthropic({
    apiKey,
    // Explicit, so ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL in the environment are ignored.
    authToken: null,
    baseURL: API_BASE_URL,
    maxRetries: MAX_RETRIES,
    // `anthropic.ts` gives up on a request at the same time, retries included.
    timeout: GENERATE_REQUEST_TIMEOUT_MS,
  });
}
