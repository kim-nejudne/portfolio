/**
 * Records real Wikimedia answers into server/generate/fixtures/ for the fake client (Kim's tool):
 *
 *   WIKIMEDIA_CONTACT=you@example.com npx tsx scripts/record-wikimedia.ts "Himeji Castle" Osaka
 *
 * For each English Wikipedia title it records what the resolver and the photo step ask: the
 * entity (or, when the title finds none, the search on it and every hit's entity), its countries,
 * the settlement ASK and, for a landmark, the photo candidates and their image info. Entities keep
 * only the claims Pinpoint reads. Existing fixtures are kept; new answers are merged in.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  FIXTURE_FILES,
  FIXTURES_DIR,
  type WikimediaFixtures,
} from '../server/generate/fakeWikimedia.js';
import {
  CANDIDATES_MAX,
  createWikimediaClient,
  depictsSearch,
  settlementQuery,
  type WikimediaClient,
} from '../server/generate/wikimedia.js';

/** The claims the resolver and the photo step read. */
export const KEPT_CLAIMS = ['P31', 'P17', 'P625', 'P18', 'P373', 'P2046'];

interface Entity {
  id: string;
  missing?: unknown;
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
  sitelinks?: Record<string, { site: string; title: string }>;
}

function trim(entity: Entity): Entity {
  const claims = Object.fromEntries(
    KEPT_CLAIMS.flatMap((p) => (entity.claims?.[p] ? [[p, entity.claims[p]]] : [])),
  );
  // Every sitelink stays (the search fallback counts them), without its badges.
  const sitelinks = Object.fromEntries(
    Object.values(entity.sitelinks ?? {}).map(({ site, title }) => [site, { site, title }]),
  );
  return { ...entity, claims, sitelinks };
}

const values = (entity: Entity, property: string): unknown[] =>
  (entity.claims?.[property] ?? []).map((claim) => claim.mainsnak?.datavalue?.value);

const itemIds = (entity: Entity, property: string): string[] =>
  values(entity, property).flatMap((v) => {
    const id = (v as { id?: unknown } | undefined)?.id;
    return typeof id === 'string' ? [id] : [];
  });

const entitiesOf = (answer: unknown): Entity[] =>
  Object.values((answer as { entities?: Record<string, Entity> }).entities ?? {}).filter(
    (e) => e.missing === undefined,
  );

const titlesOf = (list: unknown[]): string[] =>
  list.flatMap((hit) => {
    const title = (hit as { title?: unknown }).title;
    return typeof title === 'string' ? [title] : [];
  });

async function readExisting(dir: string): Promise<WikimediaFixtures> {
  const empty: WikimediaFixtures = {
    entities: {},
    search: { entities: {}, files: {}, categories: {} },
    sparql: {},
    imageinfo: {},
  };
  for (const name of FIXTURE_FILES) {
    try {
      Object.assign(empty, {
        [name]: JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8')),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return empty;
}

/** Records the answers for `titles` from `client` into the fixtures in `dir`. */
export async function recordTitles(
  client: WikimediaClient,
  titles: readonly string[],
  dir = FIXTURES_DIR,
  log: (line: string) => void = () => {},
): Promise<void> {
  const fixtures = await readExisting(dir);

  async function recordEntity(entity: Entity): Promise<void> {
    fixtures.entities[entity.id] = trim(entity);
    const countries = itemIds(entity, 'P17').filter((id) => !(id in fixtures.entities));
    if (countries.length > 0) {
      for (const country of entitiesOf(await client.entitiesById(countries))) {
        fixtures.entities[country.id] = trim(country);
      }
    }
    const query = settlementQuery(entity.id);
    const settlement = (await client.ask(query)) as { boolean?: unknown };
    fixtures.sparql[query] = settlement.boolean === true;
    if (settlement.boolean === true) return;

    // A landmark: the photo candidates, in the photo step's order, and their image info.
    const candidates = values(entity, 'P18').flatMap((v) =>
      typeof v === 'string' ? [`File:${v}`] : [],
    );
    const search = depictsSearch(entity.id);
    const found = ((await client.searchFiles(search)) as { query?: { search?: unknown[] } }).query;
    fixtures.search.files[search] = found?.search ?? [];
    candidates.push(...titlesOf(fixtures.search.files[search]));
    for (const category of values(entity, 'P373').filter((v) => typeof v === 'string')) {
      const members = (
        (await client.categoryFiles(category)) as {
          query?: { categorymembers?: unknown[] };
        }
      ).query;
      fixtures.search.categories[category] = members?.categorymembers ?? [];
      candidates.push(...titlesOf(fixtures.search.categories[category]));
    }
    const unique = [...new Set(candidates)].slice(0, CANDIDATES_MAX);
    if (unique.length === 0) return;
    const info = (await client.imageInfo(unique)) as { query?: { pages?: { title?: string }[] } };
    for (const page of info.query?.pages ?? []) {
      if (page.title && !('missing' in page)) fixtures.imageinfo[page.title] = page as never;
    }
  }

  for (const title of titles) {
    const [entity] = entitiesOf(await client.entitiesByTitle(title));
    if (entity) {
      await recordEntity(entity);
      log(`${title}: ${entity.id}`);
      continue;
    }
    const hits =
      ((await client.searchEntities(title)) as { search?: { id?: string }[] }).search ?? [];
    fixtures.search.entities[title] = hits;
    const ids = hits.flatMap((hit) => (typeof hit.id === 'string' ? [hit.id] : []));
    const found = ids.length > 0 ? entitiesOf(await client.entitiesById(ids)) : [];
    for (const hit of found) await recordEntity(hit);
    log(`${title}: no article; searched, ${found.length} hits`);
  }

  await mkdir(dir, { recursive: true });
  for (const name of FIXTURE_FILES) {
    await writeFile(join(dir, `${name}.json`), `${JSON.stringify(fixtures[name], null, 2)}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const titles = process.argv.slice(2);
  if (titles.length === 0) {
    console.error('Usage: npx tsx scripts/record-wikimedia.ts <enwiki title>…');
    process.exit(1);
  }
  const client = createWikimediaClient({ contact: process.env.WIKIMEDIA_CONTACT ?? null });
  await recordTitles(client, titles, FIXTURES_DIR, (line) => console.log(line));
  console.log(`Recorded into ${FIXTURES_DIR}`);
}
