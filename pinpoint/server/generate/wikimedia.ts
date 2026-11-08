// The Wikimedia client (spec: Wikidata and Commons resolution): Wikidata entities and search, the
// Wikidata Query Service, and Commons file search, image info and downloads. It sits behind an
// interface so the resolver and the photo step are tested with the fake in fakeWikimedia.ts, which
// GENERATE_FAKE=1 also selects. Answers are the APIs' raw JSON: callers parse them with zod.

export interface Download {
  bytes: Buffer;
  contentType: string;
}

export interface WikimediaClient {
  /** `wbgetentities` for one English Wikipedia title (`sites=enwiki`). */
  entitiesByTitle(enwikiTitle: string): Promise<unknown>;
  /** `wbgetentities` for Q-ids (at most 50). */
  entitiesById(ids: readonly string[]): Promise<unknown>;
  /** `wbsearchentities`, English, limit 7. */
  searchEntities(name: string): Promise<unknown>;
  /** A SPARQL ASK on query.wikidata.org: `{head, boolean}`. */
  ask(query: string): Promise<unknown>;
  /** Commons `list=search` in the File namespace, limit 6. */
  searchFiles(search: string): Promise<unknown>;
  /** Commons `list=categorymembers` of type file, limit 6; `category` without the "Category:" prefix. */
  categoryFiles(category: string): Promise<unknown>;
  /** Commons `prop=imageinfo` (url, size, Artist, LicenseShortName, LicenseUrl, a 1280 px thumb). */
  imageInfo(fileTitles: readonly string[]): Promise<unknown>;
  /** A file's bytes, such as an imageinfo `thumburl`. */
  download(url: string): Promise<Download>;
}

/** A failed Wikimedia request, with a message fit for the job log. */
export class WikimediaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'WikimediaError';
  }
}

export const CANDIDATES_MAX = 6;
export const SEARCH_LIMIT = 7;
export const THUMB_WIDTH = 1280;
/** Minimum gap between the end of one request and the start of the next. */
export const REQUEST_GAP_MS = 100;
/** The longest `Retry-After` honoured, so one odd header cannot stall a job for an hour. */
export const RETRY_AFTER_MAX_MS = 60_000;
/** Waits before the 1st, 2nd and 3rd retry of a 429 or 503 without `Retry-After`. */
export const RETRY_DELAYS_MS = [2000, 5000, 10000] as const;
const TIMEOUT_MS = 30_000;

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const SPARQL = 'https://query.wikidata.org/sparql';

export function userAgent(contact: string): string {
  return `Pinpoint/1.0 (https://pinpoint.kimnejudne.dev; ${contact})`;
}

/** The settlement test (resolver step 3): is `qid` an instance of a subclass of human settlement? */
export function settlementQuery(qid: string): string {
  return `ASK { wd:${qid} wdt:P31/wdt:P279* wd:Q486972 }`;
}

/** The Commons search for files that depict `qid` (photo candidates, step 1). */
export function depictsSearch(qid: string): string {
  return `haswbstatement:P180=${qid} filetype:bitmap`;
}

/** The title MediaWiki would store: underscores as spaces, first letter upper case. */
export function normalizeTitle(title: string): string {
  const spaced = title.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `Retry-After` in ms: seconds or an HTTP date; null when absent or unreadable. */
export function retryAfterMs(header: string | null, now: number): number | null {
  if (header === null || header.trim() === '') return null;
  const at = /^\d+$/.test(header.trim()) ? now + Number(header.trim()) * 1000 : Date.parse(header);
  return Number.isNaN(at) ? null : Math.min(RETRY_AFTER_MAX_MS, Math.max(0, at - now));
}

/** An https URL on upload.wikimedia.org, where Commons serves files and thumbnails. */
export function isWikimediaFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'upload.wikimedia.org';
  } catch {
    return false;
  }
}

export interface WikimediaOptions {
  /** `WIKIMEDIA_CONTACT`; the client refuses to exist without it. */
  contact: string | null;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function createWikimediaClient(options: WikimediaOptions): WikimediaClient {
  const contact = options.contact?.trim();
  if (!contact) {
    throw new WikimediaError('Wikimedia requests need WIKIMEDIA_CONTACT, which is not set');
  }
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const headers = { 'User-Agent': userAgent(contact), 'Api-User-Agent': userAgent(contact) };

  // One request at a time: each waits for the previous one to settle, then for the gap.
  let queue: Promise<unknown> = Promise.resolve();
  let lastEnd = -Infinity;

  async function attempt(url: string, accept: string): Promise<Response> {
    const wait = lastEnd + REQUEST_GAP_MS - now();
    if (wait > 0) await sleep(wait);
    try {
      return await doFetch(url, {
        headers: { ...headers, Accept: accept },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new WikimediaError(`Wikimedia request failed: ${(error as Error).message}`);
    } finally {
      lastEnd = now();
    }
  }

  /** Fetches with retries; `read` turns a response into a value, or 'retry' for a maxlag answer. */
  async function request<T>(
    url: string,
    accept: string,
    read: (response: Response) => Promise<T | 'retry'>,
  ): Promise<T> {
    for (let retry = 0; ; retry++) {
      const response = await attempt(url, accept);
      const busy = response.status === 429 || response.status === 503;
      const value = busy ? 'retry' : await read(response);
      if (value !== 'retry') return value;
      if (retry >= RETRY_DELAYS_MS.length) {
        throw new WikimediaError(
          `Wikimedia is busy (${response.status === 200 ? 'maxlag' : `HTTP ${response.status}`}) after ${RETRY_DELAYS_MS.length} retries`,
          response.status,
        );
      }
      if (!response.bodyUsed) await response.body?.cancel();
      await sleep(
        retryAfterMs(response.headers.get('Retry-After'), now()) ?? RETRY_DELAYS_MS[retry]!,
      );
    }
  }

  function enqueue<T>(run: () => Promise<T>): Promise<T> {
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  }

  const readJson = async (response: Response): Promise<unknown> => {
    if (!response.ok)
      throw new WikimediaError(`Wikimedia answered HTTP ${response.status}`, response.status);
    const body: unknown = await response.json();
    const error = (body as { error?: { code?: unknown; info?: unknown } } | null)?.error;
    if (error?.code === 'maxlag') return 'retry';
    // The code only: `info` can echo the request (a place name) into the job log.
    if (error) throw new WikimediaError(`Wikimedia API error: ${String(error.code)}`);
    return body;
  };

  const api = (base: string, params: Record<string, string>) =>
    enqueue(() => {
      // Wikidata keeps its default (documented) shapes; Commons answers pages as a list.
      // SPEC-QUESTION: no maxlag (B01, DECISIONS 69): it is for bots that edit, and Wikidata's query-service lag kept these
      // read-only calls refused for hours at maxlag=5.
      const query = new URLSearchParams({ format: 'json', ...params });
      if (base !== WIKIDATA_API) query.set('formatversion', '2');
      return request(`${base}?${query}`, 'application/json', readJson);
    });

  const entityParams = {
    action: 'wbgetentities',
    props: 'labels|descriptions|claims|sitelinks',
    languages: 'en',
  };

  return {
    entitiesByTitle: (title) =>
      api(WIKIDATA_API, { ...entityParams, sites: 'enwiki', titles: title, normalize: '1' }),
    entitiesById: (ids) => api(WIKIDATA_API, { ...entityParams, ids: ids.join('|') }),
    searchEntities: (name) =>
      api(WIKIDATA_API, {
        action: 'wbsearchentities',
        search: name,
        language: 'en',
        uselang: 'en',
        type: 'item',
        limit: String(SEARCH_LIMIT),
      }),
    ask: (query) =>
      enqueue(() =>
        request(
          `${SPARQL}?${new URLSearchParams({ query, format: 'json' })}`,
          'application/sparql-results+json',
          readJson,
        ),
      ),
    searchFiles: (search) =>
      api(COMMONS_API, {
        action: 'query',
        list: 'search',
        srsearch: search,
        srnamespace: '6',
        srlimit: String(CANDIDATES_MAX),
      }),
    categoryFiles: (category) =>
      api(COMMONS_API, {
        action: 'query',
        list: 'categorymembers',
        cmtitle: `Category:${category}`,
        cmtype: 'file',
        cmlimit: String(CANDIDATES_MAX),
      }),
    imageInfo: (titles) =>
      api(COMMONS_API, {
        action: 'query',
        prop: 'imageinfo',
        titles: titles.join('|'),
        iiprop: 'url|size|extmetadata',
        iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl',
        iiurlwidth: String(THUMB_WIDTH),
      }),
    download: (url) => {
      // The contact rides in the headers, so only Wikimedia's own file hosts get it.
      if (!isWikimediaFileUrl(url)) {
        return Promise.reject(new WikimediaError('Downloads come only from upload.wikimedia.org'));
      }
      return enqueue(() =>
        request(url, 'image/*', async (response) => {
          if (!response.ok) {
            throw new WikimediaError(`Download answered HTTP ${response.status}`, response.status);
          }
          return {
            bytes: Buffer.from(await response.arrayBuffer()),
            contentType: response.headers.get('Content-Type') ?? 'application/octet-stream',
          };
        }),
      );
    },
  };
}
