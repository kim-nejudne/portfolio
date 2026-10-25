import type { Equal, Expect } from '@dojo/type-utils';
import { z } from 'zod';
import {
  describe,
  fetchJson,
  type Fetch,
  type FetchError,
  type FetchResult,
} from './index';

const Talk = z.object({
  title: z.string(),
  at: z.iso.date().transform((text) => new Date(text)),
});

const Order = z.object({
  items: z.array(z.object({ sku: z.string(), qty: z.number() })),
});

const loadTalk = (fetcher: Fetch) => fetchJson(fetcher, '/talk', Talk);

type cases = [
  Expect<
    Equal<
      Awaited<ReturnType<typeof loadTalk>>,
      FetchResult<{ title: string; at: Date }>
    >
  >, // the value has the schema's output type
];

/** A stand-in for fetch that answers with `body` (a string is sent as it is). */
function answer(body: unknown, status = 200) {
  const sent: Response[] = [];
  const fetcher: Fetch = async () => {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const res = new Response(text, { status });
    sent.push(res);
    return res;
  };
  return { fetcher, sent };
}

test('fetchJson resolves to the parsed value', async () => {
  for (let day = 1; day <= 5; day++) {
    const at = `2026-04-0${day}`;
    const { fetcher } = answer({ title: `talk ${day}`, at, room: 'B' });
    expect(await loadTalk(fetcher)).toEqual({
      ok: true,
      value: { title: `talk ${day}`, at: new Date(at) },
    });
  }
});

test('fetchJson reports a network failure', async () => {
  const offline: Fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  expect(await fetchJson(offline, '/order', Order)).toEqual({
    ok: false,
    error: { kind: 'network', message: 'Failed to fetch' },
  });
  const odd: Fetch = () => Promise.reject('offline');
  expect(await fetchJson(odd, '/order', Order)).toEqual({
    ok: false,
    error: { kind: 'network', message: 'offline' },
  });
});

test('fetchJson reports a status without reading the body', async () => {
  for (const status of [400, 404, 418, 500, 503]) {
    const { fetcher, sent } = answer({ items: [] }, status);
    expect(await fetchJson(fetcher, '/order', Order)).toEqual({
      ok: false,
      error: { kind: 'status', status },
    });
    expect(sent[0].bodyUsed).toBe(false);
  }
});

test('fetchJson reports a body that is not JSON', async () => {
  for (const body of ['<html>', '{"items": [', '']) {
    const result = await fetchJson(answer(body).fetcher, '/order', Order);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('syntax');
      if (result.error.kind === 'syntax') {
        expect(result.error.message.length > 0).toBe(true);
      }
    }
  }
});

test('fetchJson reports every issue with a dotted path', async () => {
  const { fetcher } = answer({
    items: [{ sku: 'a', qty: 1 }, { sku: 'b', qty: '2' }, { qty: 3 }],
  });
  expect(await fetchJson(fetcher, '/order', Order)).toEqual({
    ok: false,
    error: {
      kind: 'shape',
      issues: [
        {
          path: 'items.1.qty',
          message: 'Invalid input: expected number, received string',
        },
        {
          path: 'items.2.sku',
          message: 'Invalid input: expected string, received undefined',
        },
      ],
    },
  });
  expect(await fetchJson(answer([1, 2]).fetcher, '/order', Order)).toEqual({
    ok: false,
    error: {
      kind: 'shape',
      issues: [
        { path: '', message: 'Invalid input: expected object, received array' },
      ],
    },
  });
});

test('describe gives one line per kind', () => {
  const errors: [FetchError, string][] = [
    [
      { kind: 'network', message: 'Failed to fetch' },
      'network: Failed to fetch',
    ],
    [{ kind: 'status', status: 404 }, 'HTTP 404'],
    [{ kind: 'status', status: 503 }, 'HTTP 503'],
    [{ kind: 'syntax', message: 'Unexpected end' }, 'not JSON: Unexpected end'],
    [
      {
        kind: 'shape',
        issues: [
          { path: 'items.1.qty', message: 'expected number' },
          { path: '', message: 'expected object' },
        ],
      },
      'items.1.qty: expected number; expected object',
    ],
  ];
  for (const [error, line] of errors) {
    expect(describe(error)).toBe(line);
  }
});
