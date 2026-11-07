import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ModelReply,
  type StreamingClient,
  apiErrorMessage,
  createAnthropicClient,
  replyUsage,
  send,
} from './anthropic.js';
import { GenerationError } from './generator.js';
import { MODEL_PRICES, UNKNOWN_MODEL_PRICE, addUsage, emptyUsage, pricedUsage } from './pricing.js';

const serverDir = fileURLToPath(new URL('..', import.meta.url));

function serverSources(): { file: string; source: string }[] {
  return readdirSync(serverDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.ts$/.test(file) && !/\.test\.ts$/.test(file))
    .map((file) => ({ file, source: readFileSync(join(serverDir, file), 'utf8') }));
}

function reply(model: string, usage: Partial<ModelReply['usage']> = {}): ModelReply {
  return {
    model,
    stop_reason: 'end_turn',
    content: [],
    usage: { input_tokens: 0, output_tokens: 0, ...usage },
  };
}

describe('the Anthropic client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses only the key it is given, never the SDK’s environment defaults', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-from-the-cli');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', 'oauth-token');
    vi.stubEnv('ANTHROPIC_BASE_URL', 'https://proxy.example');
    const client = createAnthropicClient('sk-ant-pinpoint');
    expect(client.apiKey).toBe('sk-ant-pinpoint');
    expect(client.authToken).toBeNull();
    expect(client.baseURL).toBe('https://api.anthropic.com');
  });

  it('is built nowhere else, and never bare', () => {
    const builders = serverSources().filter(({ source }) => /new Anthropic\s*\(/.test(source));
    expect(builders.map(({ file }) => file)).toEqual([join('generate', 'anthropic.ts')]);
    expect(builders[0]!.source).not.toMatch(/new Anthropic\s*\(\s*\)/);
  });

  it('reads no SDK credential variable anywhere in the server, and logs no key', () => {
    for (const { file, source } of serverSources()) {
      expect(source, file).not.toMatch(/process\.env\.ANTHROPIC_|env\[['"]ANTHROPIC_/);
      expect(source, file).not.toMatch(/console\.\w+\([^)]*(anthropicApiKey|apiKey)/);
    }
  });
});

describe('pricing', () => {
  it('prices a reply’s tokens, cache and web searches by its model', () => {
    const usage = replyUsage(
      reply('claude-haiku-5-5', {
        input_tokens: 1_000_000,
        output_tokens: 200_000,
        cache_read_input_tokens: 1_000_000,
        cache_creation_input_tokens: 400_000,
        server_tool_use: { web_search_requests: 7 },
      }),
    );
    expect(usage).toMatchObject({
      inputTokens: 1_000_000,
      outputTokens: 200_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 400_000,
      searches: 7,
    });
    // 0.1 + 0.1 + 0.01 + 0.05 for tokens, 7 × $0.01 for searches.
    expect(usage.costUsd).toBeCloseTo(0.26 + 0.07, 10);
  });

  it('treats missing cache and search counts as zero', () => {
    const usage = replyUsage(
      reply('claude-sonnet-5-5', { input_tokens: 500_000, output_tokens: 100_000 }),
    );
    expect(usage).toMatchObject({ cacheReadTokens: 0, cacheWriteTokens: 0, searches: 0 });
    expect(usage.costUsd).toBeCloseTo(1 + 1, 10);
  });

  it('prices an unknown model at the dearest known one', () => {
    const dearest = Math.max(...Object.values(MODEL_PRICES).map((p) => p.output));
    expect(UNKNOWN_MODEL_PRICE.output).toBe(dearest);
    const counts = { ...emptyUsage(), outputTokens: 1_000_000 };
    expect(pricedUsage('claude-unknown-9', counts).costUsd).toBe(dearest);
    // An Object method's name is not a model.
    expect(pricedUsage('toString', counts).costUsd).toBe(dearest);
  });

  it('charges $10 per 1,000 web searches on top of tokens', () => {
    expect(pricedUsage('claude-haiku-5-5', { ...emptyUsage(), searches: 1000 }).costUsd).toBe(10);
  });

  it('adds usages field by field', () => {
    const a = pricedUsage('claude-haiku-5-5', { ...emptyUsage(), inputTokens: 10, searches: 1 });
    const sum = addUsage(a, a);
    expect(sum.inputTokens).toBe(20);
    expect(sum.searches).toBe(2);
    expect(sum.costUsd).toBeCloseTo(a.costUsd * 2, 12);
  });
});

describe('send', () => {
  function client(finalMessage: () => Promise<ModelReply>) {
    const stream = vi.fn<StreamingClient['beta']['messages']['stream']>(() => ({ finalMessage }));
    return { stream, client: { beta: { messages: { stream } } } satisfies StreamingClient };
  }

  it('passes the params and the abort signal to the SDK', async () => {
    const { stream, client: c } = client(() => Promise.resolve(reply('claude-haiku-5-5')));
    const signal = new AbortController().signal;
    await expect(send(c, { model: 'm' }, emptyUsage(), signal)).resolves.toMatchObject({
      model: 'claude-haiku-5-5',
    });
    expect(stream).toHaveBeenCalledWith({ model: 'm' }, { signal });
  });

  it('turns an API failure into a plain GenerationError carrying the spend so far', async () => {
    const spent = { ...emptyUsage(), costUsd: 0.5 };
    const { client: c } = client(() =>
      Promise.reject(Object.assign(new Error('raw API text with sk-ant-secret'), { status: 401 })),
    );
    const err = await send(c, {}, spent).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GenerationError);
    expect((err as GenerationError).message).toBe(
      'The Claude API refused the key. Check PINPOINT_ANTHROPIC_API_KEY.',
    );
    expect((err as GenerationError).usage).toBe(spent);
  });

  it('names each kind of failure without the API’s own text', () => {
    expect(apiErrorMessage(new Error('socket hang up'))).toMatch(/Could not reach/);
    expect(apiErrorMessage({ status: 429 })).toMatch(/rate-limiting/);
    expect(apiErrorMessage({ status: 529 })).toMatch(/overloaded or down/);
    expect(apiErrorMessage({ status: 400 })).toBe(
      'The Claude API rejected the request (status 400).',
    );
  });
});
