import { describe, expect, it } from 'vitest';
import { CHECKER_MODEL, type ModelReply, type StreamingClient } from './anthropic.js';
import {
  BAD_FIX,
  CHECKER_DROP,
  CHECKER_SYSTEM,
  NO_VERDICT,
  checkerPrompt,
  createChecker,
  judge,
} from './checker.js';
import { type CheckItem, GenerationError } from './generator.js';
import { WEB_SEARCH_USD_PER_SEARCH } from './pricing.js';

const osaka: CheckItem = {
  id: 'p1',
  kind: 'city',
  name: 'Osaka',
  displayName: 'Osaka',
  wikidataId: 'Q35765',
  description: 'designated city in Kansai, Japan',
  country: 'Japan',
  lat: 34.69,
  lng: 135.5,
  fact: 'Its Dōtonbori canal district is famed for giant moving shop signs.',
};
const himeji: CheckItem = {
  id: 'p2',
  kind: 'landmark',
  name: 'Himeji Castle',
  displayName: 'Himeji Castle',
  wikidataId: 'Q188754',
  description: 'castle in Himeji, <Hyōgo>',
  country: 'Japan',
  lat: 34.84,
  lng: 134.69,
  fact: 'Nicknamed the White Heron for its white plastered walls.',
};
const items = [osaka, himeji];
const options = { level: 'easy' as const, maxSearches: 10 };

type Params = { tools: Record<string, unknown>[]; messages: { content: unknown }[] };

function stubClient(answers: (ModelReply | Error)[]) {
  const requests: Params[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  const client: StreamingClient = {
    beta: {
      messages: {
        stream(params, opts) {
          requests.push(params as Params);
          signals.push(opts?.signal);
          const answer = answers.shift() ?? new Error('no more replies');
          return {
            finalMessage: () =>
              answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer),
          };
        },
      },
    },
  };
  return { client, requests, signals };
}

const checkerReply = (over: Partial<ModelReply>): ModelReply => ({
  model: CHECKER_MODEL,
  stop_reason: 'tool_use',
  content: [],
  usage: { input_tokens: 1_000_000, output_tokens: 0 },
  ...over,
});

const submit = (verdicts: unknown): ModelReply['content'][number] => ({
  type: 'tool_use',
  name: 'submit_verdicts',
  input: { verdicts },
});

class StatusError extends Error {
  constructor(readonly status: number) {
    super(`status ${status}`);
  }
}

describe('checker request', () => {
  it('asks Haiku 5.5 with the search cap passed to the API and a strict submit_verdicts tool', async () => {
    const { client, requests, signals } = stubClient([checkerReply({ content: [submit([])] })]);
    const signal = new AbortController().signal;
    await createChecker(client).check(items, options, signal);
    const [params] = requests;
    expect(params).toMatchObject({
      model: 'claude-haiku-5-5',
      tool_choice: { type: 'auto' },
      system: [{ type: 'text', text: CHECKER_SYSTEM, cache_control: { type: 'ephemeral' } }],
    });
    expect(params!.tools[0]).toEqual({
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 10,
    });
    expect(params!.tools[1]).toMatchObject({
      name: 'submit_verdicts',
      strict: true,
      input_schema: {
        properties: {
          verdicts: {
            items: {
              required: ['id', 'verdict', 'reason'],
              additionalProperties: false,
              properties: { verdict: { enum: ['ok', 'fix', 'drop'] }, fact: {}, displayName: {} },
            },
          },
        },
      },
    });
    // Only fact and displayName can be fixed: no coordinate or item field in the tool.
    const fields = Object.keys(
      (
        params!.tools[1] as {
          input_schema: { properties: { verdicts: { items: { properties: object } } } };
        }
      ).input_schema.properties.verdicts.items.properties,
    );
    expect(fields.sort()).toEqual(['displayName', 'fact', 'id', 'reason', 'verdict']);
    expect(signals[0]).toBe(signal);
  });

  it('shows each place with its Wikidata id, description, country, coordinates and fact, as data', () => {
    const prompt = checkerPrompt(items, 'hard', 3);
    for (const text of ['"Q35765"', 'designated city in Kansai', '"Japan"', '34.69', '135.5']) {
      expect(prompt).toContain(text);
    }
    expect(prompt).toContain(osaka.fact);
    expect(prompt).toContain('castle in Himeji, ‹Hyōgo›');
    expect(prompt).toContain('Level: Hard');
    expect(prompt).toContain('up to 3 web searches');
    expect(checkerPrompt(items, 'easy', 0)).toContain('No web searches are left');
  });

  it('names the spec’s drop rules in the system prompt', () => {
    for (const rule of [
      'wrong entity',
      'out of date',
      'fit the level',
      'better-known place in the same region',
      'compact single site',
      'offensive',
      "can't change the item, its name or its coordinates",
    ]) {
      expect(CHECKER_SYSTEM).toContain(rule);
    }
  });

  it('leaves web search out when the level has no searches left', async () => {
    const { client, requests } = stubClient([checkerReply({ content: [submit([])] })]);
    await createChecker(client).check(items, { level: 'easy', maxSearches: 0 });
    expect(requests[0]!.tools.map((t) => t.name)).toEqual(['submit_verdicts']);
  });
});

describe('checker loop', () => {
  it('returns the submitted verdicts with the searches counted and priced', async () => {
    const verdicts = [
      { id: 'p1', verdict: 'ok', reason: 'yes' },
      { id: 'p2', verdict: 'drop', reason: 'no' },
    ];
    const { client } = stubClient([
      checkerReply({
        content: [
          { type: 'server_tool_use' },
          { type: 'web_search_tool_result' },
          submit(verdicts),
        ],
        usage: { input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 3 } },
      }),
    ]);
    const result = await createChecker(client).check(items, options);
    expect(result.verdicts).toEqual(verdicts);
    expect(result.usage.searches).toBe(3);
    expect(result.usage.costUsd).toBeCloseTo(3 * WEB_SEARCH_USD_PER_SEARCH);
  });

  it('resumes a paused turn with what is left of the level’s search cap', async () => {
    const paused = [{ type: 'server_tool_use' }, { type: 'web_search_tool_result' }];
    const { client, requests } = stubClient([
      checkerReply({
        stop_reason: 'pause_turn',
        content: paused,
        usage: { input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 4 } },
      }),
      checkerReply({ content: [submit([{ id: 'p1', verdict: 'ok', reason: 'x' }])] }),
    ]);
    const result = await createChecker(client).check(items, options);
    expect(result.verdicts).toHaveLength(1);
    expect(requests[1]!.messages).toEqual([
      requests[0]!.messages[0],
      { role: 'assistant', content: paused },
    ]);
    expect(requests[1]!.tools[0]!.max_uses).toBe(6);
    expect(result.usage.searches).toBe(4);
  });

  it('asks once more when a reply ends without verdicts, then fails with the spend', async () => {
    const said = [{ type: 'text', text: 'All look fine.' }];
    const nudged = stubClient([
      checkerReply({ stop_reason: 'end_turn', content: said }),
      checkerReply({ content: [submit([{ id: 'p1', verdict: 'ok', reason: 'x' }])] }),
    ]);
    expect((await createChecker(nudged.client).check(items, options)).verdicts).toHaveLength(1);
    expect(nudged.requests[1]!.messages[1]).toEqual({ role: 'assistant', content: said });
    expect(nudged.requests[1]!.messages[2]!.content).toContain('submit_verdicts');

    const silent = stubClient([
      checkerReply({ stop_reason: 'end_turn', content: said }),
      checkerReply({ stop_reason: 'end_turn', content: said }),
    ]);
    const err = await createChecker(silent.client)
      .check(items, options)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GenerationError);
    expect((err as GenerationError).message).toBe('The check ended without verdicts. Try again.');
    expect((err as GenerationError).usage.inputTokens).toBe(2_000_000);
  });

  it('gives up after too many paused turns', async () => {
    const pause = () => checkerReply({ stop_reason: 'pause_turn' });
    const { client, requests } = stubClient([1, 2, 3, 4, 5, 6].map(pause));
    await expect(createChecker(client).check(items, options)).rejects.toThrow(
      'The check ran too long. Try again.',
    );
    expect(requests).toHaveLength(6);
  });

  it('returns no verdicts for a malformed submit_verdicts input', async () => {
    const { client } = stubClient([
      checkerReply({ content: [{ type: 'tool_use', name: 'submit_verdicts', input: { v: 1 } }] }),
    ]);
    expect((await createChecker(client).check(items, options)).verdicts).toEqual([]);
  });

  it('fails with a plain message on a refusal or an API error', async () => {
    const refusing = stubClient([checkerReply({ stop_reason: 'refusal' })]);
    await expect(createChecker(refusing.client).check(items, options)).rejects.toThrow(
      'Claude declined to check these places.',
    );
    const failing = stubClient([new StatusError(401)]);
    await expect(createChecker(failing.client).check(items, options)).rejects.toThrow(
      'The Claude API refused the key. Check PINPOINT_ANTHROPIC_API_KEY.',
    );
  });
});

describe('judge', () => {
  it('keeps ok places in order and keeps each drop’s reason', () => {
    const out = judge(items, [
      { id: 'p2', verdict: 'drop', reason: '  Not a compact site  ' },
      { id: 'p1', verdict: 'ok', reason: 'fine' },
    ]);
    expect(out.kept).toEqual([osaka]);
    expect(out.dropped).toEqual([{ item: himeji, reason: 'Not a compact site' }]);
  });

  it('lets a fix change only fact and displayName, never coordinates or the item', () => {
    const out = judge(items, [
      {
        id: 'p1',
        verdict: 'fix',
        fact: '  Home to Japan’s oldest Buddhist temple built by the state.  ',
        displayName: 'Ōsaka',
        lat: 0,
        lng: 0,
        wikidataId: 'Q90',
        name: 'Paris',
        kind: 'landmark',
        country: 'France',
        reason: 'Fact clarified',
      },
      { id: 'p2', verdict: 'ok', reason: 'fine' },
    ]);
    expect(out.kept[0]).toEqual({
      ...osaka,
      fact: 'Home to Japan’s oldest Buddhist temple built by the state.',
      displayName: 'Ōsaka',
    });
    expect(out.dropped).toEqual([]);
  });

  it('keeps the old value for a field the fix leaves out, and a landmark’s display name', () => {
    const out = judge(items, [
      { id: 'p1', verdict: 'fix', fact: 'Grew up around a castle.', reason: 'x' },
      { id: 'p2', verdict: 'fix', displayName: 'White Heron', reason: 'x' },
    ]);
    expect(out.kept).toEqual([{ ...osaka, fact: 'Grew up around a castle.' }, himeji]);
  });

  it('drops a place with no verdict, a bad fix or an empty drop reason', () => {
    const third = { ...osaka, id: 'p3' };
    const out = judge(
      [osaka, himeji, third],
      [
        { id: 'p1', verdict: 'fix', fact: 'x'.repeat(91), reason: 'x' },
        { id: 'p3', verdict: 'drop', reason: '' },
        { id: 'p2', verdict: 'maybe', reason: 'x' },
      ],
    );
    expect(out.kept).toEqual([]);
    expect(out.dropped).toEqual([
      { item: osaka, reason: BAD_FIX },
      { item: himeji, reason: NO_VERDICT },
      { item: third, reason: CHECKER_DROP },
    ]);
  });

  it('takes the first valid verdict for an id', () => {
    const out = judge(
      [osaka],
      [
        { id: 'p1', verdict: 'ok', reason: 'x' },
        { id: 'p1', verdict: 'drop', reason: 'later' },
      ],
    );
    expect(out.kept).toEqual([osaka]);
  });
});
