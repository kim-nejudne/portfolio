// The Claude API side of generation (spec: Jobs and limits, Generation pipeline). Ported from Buzzr
// (buzzer/server/generate/client.ts and anthropic.ts). This is the one place that builds an
// Anthropic SDK client: the key comes only from PINPOINT_ANTHROPIC_API_KEY and is passed
// explicitly, because the SDK constructor would otherwise fall back to ANTHROPIC_API_KEY,
// ANTHROPIC_AUTH_TOKEN or ANTHROPIC_BASE_URL. Requests go through `StreamingClient`, the one SDK
// method used, so tests pass a stub and never reach the API. The writer (F39), checker (F40) and
// sign checker (M6) build their requests on `send` and `replyUsage`.

import Anthropic from '@anthropic-ai/sdk';
import { GenerationError } from './generator.js';
import { type Usage, emptyUsage, pricedUsage } from './pricing.js';

export const WRITER_MODEL = 'claude-sonnet-5-5';
export const CHECKER_MODEL = 'claude-haiku-5-5';

const API_BASE_URL = 'https://api.anthropic.com';
/** Retries on 408, 409, 429 and 5xx (529 included), with the SDK's backoff. */
const MAX_RETRIES = 3;

/** The parts of a Messages API reply generation reads. */
export interface ModelReply {
  model: string;
  stop_reason: string | null;
  content: readonly { type: string; text?: string; name?: string; input?: unknown }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    server_tool_use?: { web_search_requests?: number | null } | null;
  };
}

/** `client.beta.messages.stream(params, {signal}).finalMessage()`, as the SDK client has it. */
export interface StreamingClient {
  beta: {
    messages: {
      stream(
        params: object,
        options?: { signal?: AbortSignal },
      ): { finalMessage(): Promise<ModelReply> };
    };
  };
}

export function createAnthropicClient(apiKey: string): Anthropic & StreamingClient {
  return new Anthropic({
    apiKey,
    // Explicit, so ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL in the environment are ignored.
    authToken: null,
    baseURL: API_BASE_URL,
    maxRetries: MAX_RETRIES,
  });
}

/** One reply's tokens and web searches, priced by its model. */
export function replyUsage(reply: ModelReply): Usage {
  return pricedUsage(reply.model, {
    inputTokens: reply.usage.input_tokens,
    outputTokens: reply.usage.output_tokens,
    cacheReadTokens: reply.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: reply.usage.cache_creation_input_tokens ?? 0,
    searches: reply.usage.server_tool_use?.web_search_requests ?? 0,
  });
}

/** A plain message for an API failure, never the API's own text. The SDK has already retried. */
export function apiErrorMessage(err: unknown): string {
  const status =
    typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
      ? err.status
      : null;
  if (status === null) return 'Could not reach the Claude API. Check the connection and try again.';
  if (status === 401 || status === 403) {
    return 'The Claude API refused the key. Check PINPOINT_ANTHROPIC_API_KEY.';
  }
  if (status === 429) return 'The Claude API is rate-limiting this key. Try again in a minute.';
  if (status >= 500) return 'The Claude API is overloaded or down. Try again later.';
  return `The Claude API rejected the request (status ${status}).`;
}

/** Sends one request; a failure is a GenerationError carrying `usage`, the spend so far. */
export async function send(
  client: StreamingClient,
  params: object,
  usage: Usage = emptyUsage(),
  signal?: AbortSignal,
): Promise<ModelReply> {
  try {
    return await client.beta.messages.stream(params, signal ? { signal } : {}).finalMessage();
  } catch (err) {
    throw new GenerationError(apiErrorMessage(err), usage, { cause: err });
  }
}
