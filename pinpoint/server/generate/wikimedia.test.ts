import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordTitles } from '../../scripts/record-wikimedia.js';
import { createFakeWikimediaClient, readFixtures, wikimediaClientFor } from './fakeWikimedia.js';
import {
  RETRY_AFTER_MAX_MS,
  WikimediaError,
  createWikimediaClient,
  depictsSearch,
  retryAfterMs,
  settlementQuery,
} from './wikimedia.js';

const UA = 'Pinpoint/1.0 (https://pinpoint.kimnejudne.dev; kim@example.test)';

interface Call {
  url: string;
  headers: Record<string, string>;
  start: number;
  end?: number;
}

/**
 * A fake clock and fetch: `sleep` advances the clock, each request takes `requestMs`, and
 * `answers` are served in order (then 200 `{}`).
 */
function harness(answers: (() => Response)[] = [], requestMs = 30) {
  let clock = 1_000_000;
  const sleeps: number[] = [];
  const calls: Call[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      url: String(url),
      headers: init?.headers as Record<string, string>,
      start: clock,
    };
    calls.push(call);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    clock += requestMs;
    inFlight--;
    call.end = clock;
    return answers.shift()?.() ?? Response.json({});
  });
  const client = createWikimediaClient({
    contact: 'kim@example.test',
    fetch: fetch as typeof globalThis.fetch,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
  });
  return { client, calls, sleeps, fetch, maxInFlight: () => maxInFlight };
}

const busy = (status: number, retryAfter?: string) => () =>
  new Response('busy', { status, headers: retryAfter ? { 'Retry-After': retryAfter } : {} });

describe('createWikimediaClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses to exist without WIKIMEDIA_CONTACT', () => {
    expect(() => createWikimediaClient({ contact: null })).toThrow(/WIKIMEDIA_CONTACT/);
    expect(() => createWikimediaClient({ contact: '  ' })).toThrow(WikimediaError);
    expect(() => wikimediaClientFor({ generateFake: false, wikimediaContact: null })).toThrow(
      /WIKIMEDIA_CONTACT/,
    );
  });

  it('sends the Pinpoint User-Agent on every request and no maxlag (B01)', async () => {
    const { client, calls } = harness([
      () => Response.json({ entities: {} }),
      () => Response.json({ search: [] }),
      () => Response.json({ head: {}, boolean: true }),
      () => Response.json({ query: {} }),
      () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } }),
    ]);
    await client.entitiesByTitle('Himeji Castle');
    await client.searchEntities('Osaka');
    expect(await client.ask(settlementQuery('Q35765'))).toEqual({ head: {}, boolean: true });
    await client.imageInfo(['File:A.jpg', 'File:B.jpg']);
    const file = await client.download('https://upload.wikimedia.org/a.jpg');
    expect(file).toEqual({ bytes: Buffer.from([1, 2, 3]), contentType: 'image/jpeg' });

    for (const call of calls) expect(call.headers['User-Agent']).toBe(UA);
    const [entities, search, sparql, info] = calls.map((c) => new URL(c.url));
    expect(entities!.host).toBe('www.wikidata.org');
    // B01: Wikidata's query-service lag kept maxlag=5 calls refused for hours.
    expect(entities!.searchParams.has('maxlag')).toBe(false);
    expect(entities!.searchParams.get('sites')).toBe('enwiki');
    expect(entities!.searchParams.get('titles')).toBe('Himeji Castle');
    expect(search!.searchParams.has('maxlag')).toBe(false);
    expect(search!.searchParams.get('limit')).toBe('7');
    expect(sparql!.host).toBe('query.wikidata.org');
    expect(sparql!.searchParams.get('query')).toBe(
      'ASK { wd:Q35765 wdt:P31/wdt:P279* wd:Q486972 }',
    );
    expect(sparql!.searchParams.has('maxlag')).toBe(false);
    expect(info!.host).toBe('commons.wikimedia.org');
    expect(info!.searchParams.get('titles')).toBe('File:A.jpg|File:B.jpg');
    expect(info!.searchParams.get('iiurlwidth')).toBe('1280');
    expect(info!.searchParams.has('maxlag')).toBe(false);
  });

  it('runs one request at a time, at least 100 ms apart', async () => {
    const { client, calls, maxInFlight } = harness();
    await Promise.all([
      client.entitiesById(['Q17']),
      client.searchFiles(depictsSearch('Q188754')),
      client.categoryFiles('Himeji Castle'),
      client.ask(settlementQuery('Q17')),
    ]);
    expect(calls).toHaveLength(4);
    expect(maxInFlight()).toBe(1);
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]!.start - calls[i - 1]!.end!).toBeGreaterThanOrEqual(100);
    }
    expect(new URL(calls[1]!.url).searchParams.get('srsearch')).toBe(
      'haswbstatement:P180=Q188754 filetype:bitmap',
    );
    expect(new URL(calls[2]!.url).searchParams.get('cmtitle')).toBe('Category:Himeji Castle');
  });

  it('keeps the queue going after a failed request', async () => {
    const { client, calls } = harness([() => new Response('nope', { status: 404 })]);
    await expect(client.entitiesById(['Q1'])).rejects.toMatchObject({ status: 404 });
    await expect(client.entitiesById(['Q2'])).resolves.toEqual({});
    expect(calls[1]!.start - calls[0]!.end!).toBeGreaterThanOrEqual(100);
  });

  it('retries a 429 or 503 after 2, 5 and 10 s, then gives up', async () => {
    const { client, calls, sleeps } = harness([
      busy(503),
      busy(429),
      busy(503),
      busy(503),
      busy(503),
    ]);
    await expect(client.entitiesById(['Q1'])).rejects.toThrow(/busy \(HTTP 503\) after 3 retries/);
    expect(calls).toHaveLength(4);
    expect(sleeps.filter((ms) => ms >= 1000)).toEqual([2000, 5000, 10000]);
  });

  it('honours Retry-After in seconds or as a date, and succeeds on a retry', async () => {
    const { client, calls, sleeps } = harness([
      busy(429, '7'),
      // The clock is at 1_007_060 when the 503 arrives: 30 ms, a 7 s wait, 30 ms.
      busy(503, new Date(1_007_060 + 4000).toUTCString()),
      () => Response.json({ entities: { Q1: { id: 'Q1' } } }),
    ]);
    await expect(client.entitiesById(['Q1'])).resolves.toEqual({ entities: { Q1: { id: 'Q1' } } });
    expect(calls).toHaveLength(3);
    // The HTTP date has whole seconds, so it lands within a second of 4 s.
    expect(sleeps[0]).toBe(7000);
    expect(sleeps[1]).toBeGreaterThan(3000);
    expect(sleeps[1]).toBeLessThanOrEqual(4000);
  });

  it('retries a maxlag answer like a 503, and fails on other API errors', async () => {
    const { client, sleeps } = harness([
      () => Response.json({ error: { code: 'maxlag', info: 'Waiting for 5 seconds lagged' } }),
      () => Response.json({ entities: {} }),
      () => Response.json({ error: { code: 'no-such-entity', info: 'Could not find Q0' } }),
    ]);
    await expect(client.entitiesById(['Q1'])).resolves.toEqual({ entities: {} });
    expect(sleeps).toContain(2000);
    await expect(client.entitiesById(['Q0'])).rejects.toThrow(
      new WikimediaError('Wikimedia API error: no-such-entity'),
    );
  });

  it('names maxlag when its retries run out', async () => {
    const lagged = () => Response.json({ error: { code: 'maxlag', info: 'lagged' } });
    const { client, calls } = harness([lagged, lagged, lagged, lagged]);
    await expect(client.searchEntities('Osaka')).rejects.toThrow(
      'Wikimedia is busy (maxlag) after 3 retries',
    );
    expect(calls).toHaveLength(4);
  });

  it('downloads only from upload.wikimedia.org, so the contact goes nowhere else', async () => {
    const { client, calls } = harness();
    for (const url of [
      'https://example.com/a.jpg',
      'http://upload.wikimedia.org/a.jpg',
      'https://upload.wikimedia.org.evil.test/a.jpg',
      'not a url',
    ]) {
      await expect(client.download(url)).rejects.toThrow(
        'Downloads come only from upload.wikimedia.org',
      );
    }
    expect(calls).toHaveLength(0);
  });

  it('turns a network failure into a WikimediaError', async () => {
    const client = createWikimediaClient({
      contact: 'kim@example.test',
      fetch: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch,
      now: () => 0,
      sleep: async () => {},
    });
    await expect(client.ask('ASK {}')).rejects.toThrow(
      new WikimediaError('Wikimedia request failed: fetch failed'),
    );
  });

  it('reads Retry-After', () => {
    expect(retryAfterMs(null, 0)).toBeNull();
    expect(retryAfterMs('soon', 0)).toBeNull();
    expect(retryAfterMs('3', 0)).toBe(3000);
    expect(retryAfterMs('3600', 0)).toBe(RETRY_AFTER_MAX_MS);
    expect(retryAfterMs(new Date(0).toUTCString(), 5000)).toBe(0);
  });
});

describe('the fake client (GENERATE_FAKE=1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** The fake must never reach the network: any fetch fails the test. */
  function offline() {
    const fetch = vi.fn(() => {
      throw new Error('network');
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('is selected by GENERATE_FAKE=1 and needs no contact', async () => {
    const fetch = offline();
    const client = wikimediaClientFor({ generateFake: true, wikimediaContact: null });
    const answer = (await client.entitiesByTitle('osaka')) as { entities: Record<string, unknown> };
    expect(Object.keys(answer.entities)).toEqual(['Q35765']);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers entities, search, SPARQL and image info in the APIs’ shapes', async () => {
    const fetch = offline();
    const client = createFakeWikimediaClient();
    const castle = (await client.entitiesByTitle('Himeji_Castle')) as {
      entities: Record<string, { id: string; claims: Record<string, unknown[]> }>;
      success: number;
    };
    expect(castle.success).toBe(1);
    expect(castle.entities.Q188754!.claims.P625).toEqual([
      expect.objectContaining({
        rank: 'normal',
        mainsnak: expect.objectContaining({
          datavalue: expect.objectContaining({
            value: expect.objectContaining({ latitude: 34.839447, longitude: 134.693906 }),
          }),
        }),
      }),
    ]);
    expect(await client.entitiesByTitle('Nowhere at all')).toEqual({
      entities: { '-1': { site: 'enwiki', title: 'Nowhere at all', missing: '' } },
      success: 1,
    });
    expect(await client.entitiesById(['Q17', 'Q0'])).toMatchObject({
      entities: { Q17: { labels: { en: { value: 'Japan' } } }, Q0: { id: 'Q0', missing: '' } },
    });
    expect(await client.searchEntities('Osaka')).toMatchObject({
      search: [{ id: 'Q35765' }, { id: 'Q122723' }],
    });
    expect(await client.searchEntities('Atlantis')).toMatchObject({ search: [] });
    expect(await client.ask(settlementQuery('Q35765'))).toEqual({ head: {}, boolean: true });
    expect(await client.ask(settlementQuery('Q188754'))).toEqual({ head: {}, boolean: false });
    await expect(client.ask(settlementQuery('Q1'))).rejects.toThrow(/No SPARQL fixture/);
    expect(await client.searchFiles(depictsSearch('Q183536'))).toMatchObject({
      query: { search: [{ title: 'File:Tokyo Tower sign at entrance.jpg' }, {}] },
    });
    expect(await client.categoryFiles('Himeji Castle')).toMatchObject({
      query: { categorymembers: [{ ns: 6 }, { title: 'File:Himeji Castle map GFDL.png' }] },
    });
    const info = (await client.imageInfo(['File:Tokyo Tower 2023.jpg', 'File:Gone.jpg'])) as {
      query: { pages: { title: string; missing?: boolean; imageinfo?: unknown[] }[] };
    };
    expect(info.query.pages[0]!.imageinfo![0]).toMatchObject({
      width: 3200,
      height: 4800,
      extmetadata: { LicenseShortName: { value: 'CC0' } },
    });
    expect(info.query.pages[1]).toEqual({ ns: 6, title: 'File:Gone.jpg', missing: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('serves a numbered placeholder image for a fixture file', async () => {
    offline();
    const client = createFakeWikimediaClient();
    const info = (await client.imageInfo(['File:Himeji castle in winter.jpg'])) as {
      query: { pages: { imageinfo: { thumburl: string }[] }[] };
    };
    const file = await client.download(info.query.pages[0]!.imageinfo[0]!.thumburl);
    expect(file.contentType).toBe('image/svg+xml');
    const svg = file.bytes.toString();
    expect(svg).toMatch(/^<svg [^>]*width="1024" height="683"/);
    expect(svg).toContain('>2</text>');
    await expect(client.download('https://upload.wikimedia.org/other.jpg')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('scripts/record-wikimedia.ts', () => {
  it('records what the resolver and photo step ask, in a form the fake answers again', async () => {
    const source = readFixtures();
    const dir = mkdtempSync(join(tmpdir(), 'pinpoint-record-'));
    const lines: string[] = [];
    await recordTitles(
      createFakeWikimediaClient(source),
      ['Himeji Castle', 'Osaka', 'Himeji-jo', 'Atlantis'],
      dir,
      (line) => lines.push(line),
    );
    expect(lines).toEqual([
      'Himeji Castle: Q188754',
      'Osaka: Q35765',
      'Himeji-jo: no article; searched, 1 hits',
      'Atlantis: no article; searched, 0 hits',
    ]);
    const recorded = readFixtures(dir);
    expect(Object.keys(recorded.entities).sort()).toEqual(['Q17', 'Q188754', 'Q35765']);
    for (const id of ['Q17', 'Q188754', 'Q35765']) {
      expect(recorded.entities[id]).toEqual(source.entities[id]);
    }
    expect(recorded.sparql).toEqual({
      [settlementQuery('Q188754')]: false,
      [settlementQuery('Q35765')]: true,
    });
    expect(recorded.search.entities).toEqual({
      'Himeji-jo': source.search.entities['Himeji-jo'],
      Atlantis: [],
    });
    expect(recorded.search.files).toEqual({
      [depictsSearch('Q188754')]: source.search.files[depictsSearch('Q188754')],
    });
    expect(recorded.search.categories).toEqual({
      'Himeji Castle': source.search.categories['Himeji Castle'],
    });
    expect(Object.keys(recorded.imageinfo)).toEqual([
      'File:Himeji Castle The Keep Towers.jpg',
      'File:Himeji castle in winter.jpg',
      'File:Himeji Castle map GFDL.png',
    ]);
    for (const [title, page] of Object.entries(recorded.imageinfo)) {
      expect(page).toEqual(source.imageinfo[title]);
    }
    // The written files are plain JSON the fake reads back.
    expect(JSON.parse(readFileSync(join(dir, 'sparql.json'), 'utf8'))).toEqual(recorded.sparql);
  });
});
