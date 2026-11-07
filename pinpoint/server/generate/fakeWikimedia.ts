// The fake Wikimedia client (spec: Generation pipeline): GENERATE_FAKE=1 and every test use it. It
// answers from the JSON in server/generate/fixtures/ (written by hand or by
// scripts/record-wikimedia.ts) in the envelopes the real APIs use, and serves placeholder images
// (a solid colour and a number) instead of Commons files. It never opens a network connection.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Env } from '../env.js';
import { WikimediaError, createWikimediaClient, type WikimediaClient } from './wikimedia.js';

export const FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url));

/** The fixture folder: one file per kind of answer. */
export interface WikimediaFixtures {
  /** entities.json: Q-id → the entity as `wbgetentities` gives it. */
  entities: Record<string, { sitelinks?: Record<string, { title: string }> }>;
  /** search.json: `wbsearchentities` hits by search text, Commons search and category files. */
  search: {
    entities: Record<string, unknown[]>;
    files: Record<string, unknown[]>;
    categories: Record<string, unknown[]>;
  };
  /** sparql.json: ASK query → answer. */
  sparql: Record<string, boolean>;
  /** imageinfo.json: "File:…" → the page as `prop=imageinfo&formatversion=2` gives it. */
  imageinfo: Record<
    string,
    { imageinfo?: { url?: string; thumburl?: string; thumbwidth?: number; thumbheight?: number }[] }
  >;
}

export const FIXTURE_FILES = ['entities', 'search', 'sparql', 'imageinfo'] as const;

export function readFixtures(dir = FIXTURES_DIR): WikimediaFixtures {
  const read = (name: string): unknown =>
    JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
  return Object.fromEntries(FIXTURE_FILES.map((name) => [name, read(name)])) as never;
}

/** The title MediaWiki would store: underscores as spaces, first letter upper case. */
export function normalizeTitle(title: string): string {
  const spaced = title.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const PLACEHOLDER_COLOURS = ['#2F6F8F', '#8F4A2F', '#4F7F3A', '#6A4C93', '#9A7B1E', '#3A6D6D'];

/** A solid-colour SVG with a big number on it. */
export function placeholderSvg(number: number, width: number, height: number): string {
  const fill = PLACEHOLDER_COLOURS[(number - 1) % PLACEHOLDER_COLOURS.length]!;
  const size = Math.round(Math.min(width, height) / 2);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="100%" height="100%" fill="${fill}"/>` +
    `<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" ` +
    `font-family="sans-serif" font-size="${size}" fill="#FFFFFF">${number}</text></svg>`
  );
}

export function createFakeWikimediaClient(
  fixtures: WikimediaFixtures = readFixtures(),
): WikimediaClient {
  return {
    entitiesByTitle: async (title) => {
      const wanted = normalizeTitle(title);
      const entity = Object.values(fixtures.entities).find(
        (e) => e.sitelinks?.enwiki?.title === wanted,
      );
      const id = entity && (entity as { id?: string }).id;
      return id
        ? { entities: { [id]: entity }, success: 1 }
        : { entities: { '-1': { site: 'enwiki', title: wanted, missing: '' } }, success: 1 };
    },
    entitiesById: async (ids) => ({
      entities: Object.fromEntries(
        ids.map((id) => [id, fixtures.entities[id] ?? { id, missing: '' }]),
      ),
      success: 1,
    }),
    searchEntities: async (name) => ({
      searchinfo: { search: name },
      search: fixtures.search.entities[name] ?? [],
      success: 1,
    }),
    ask: async (query) => {
      const answer = fixtures.sparql[query];
      // An unrecorded query is a missing fixture, not a "no": say so loudly.
      if (answer === undefined) throw new WikimediaError(`No SPARQL fixture for: ${query}`);
      return { head: {}, boolean: answer };
    },
    searchFiles: async (search) => ({
      batchcomplete: true,
      query: { search: fixtures.search.files[search] ?? [] },
    }),
    categoryFiles: async (category) => ({
      batchcomplete: true,
      query: { categorymembers: fixtures.search.categories[category] ?? [] },
    }),
    imageInfo: async (titles) => ({
      batchcomplete: true,
      query: {
        pages: titles.map(
          (title) => fixtures.imageinfo[normalizeTitle(title)] ?? { ns: 6, title, missing: true },
        ),
      },
    }),
    download: async (url) => {
      const files = Object.values(fixtures.imageinfo);
      const index = files.findIndex((page) =>
        page.imageinfo?.some((info) => info.url === url || info.thumburl === url),
      );
      if (index < 0) throw new WikimediaError(`Download answered HTTP 404`, 404);
      const info = files[index]!.imageinfo![0]!;
      const svg = placeholderSvg(index + 1, info.thumbwidth ?? 1280, info.thumbheight ?? 960);
      return { bytes: Buffer.from(svg), contentType: 'image/svg+xml' };
    },
  };
}

/** The client generation uses: the fake under `GENERATE_FAKE=1`, else the real one (needs a contact). */
export function wikimediaClientFor(
  env: Pick<Env, 'generateFake' | 'wikimediaContact'>,
): WikimediaClient {
  return env.generateFake
    ? createFakeWikimediaClient()
    : createWikimediaClient({ contact: env.wikimediaContact });
}
