import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { shortText } from '#shared/placeCheck.js';
import type { Box, PlaceKind } from '#shared/types.js';
import { CategoryStore } from '../categoryStore.js';
import { FAKE_BOX, FAKE_EMOJI, fakeGenerator } from './fake.js';
import {
  createFakeWikimediaClient,
  readFixtures,
  type WikimediaFixtures,
} from './fakeWikimedia.js';
import {
  GenerationError,
  type CheckItem,
  type PlaceChecker,
  type PlaceWriter,
  type WriteRequest,
  type WriteResult,
} from './generator.js';
import {
  GENERATE_SEARCHES_MAX,
  NO_BOX,
  PIPELINE_DROP,
  WIKIDATA_DOWN,
  generateLevel,
  inferLabelStyle,
  repeatsName,
  saveLevel,
  type LevelRequest,
  type LevelStage,
} from './pipeline.js';
import { emptyUsage, type Usage } from './pricing.js';
import { DROP } from './resolver.js';
import { WikimediaError, settlementQuery, type WikimediaClient } from './wikimedia.js';

const JAPAN: Box = { south: 24, west: 122, north: 46, east: 146 };
const KANSAI: Box = { south: 33.5, west: 134, north: 36, east: 137 };

// ---- A Wikimedia world: the shared fixtures plus numbered towns and sites in Japan ----

const st = (value: unknown) => ({
  rank: 'normal',
  type: 'statement',
  mainsnak: { snaktype: 'value', datavalue: { value } },
});

function entity(id: string, label: string, country: string, lat: number, lng: number) {
  return {
    type: 'item',
    id,
    labels: { en: { language: 'en', value: label } },
    descriptions: { en: { language: 'en', value: `test ${label}` } },
    claims: {
      P31: [st({ 'entity-type': 'item', id: 'Q515' })],
      P17: [st({ 'entity-type': 'item', id: country })],
      P625: [st({ latitude: lat, longitude: lng, globe: 'Q2' })],
    },
    sitelinks: { enwiki: { site: 'enwiki', title: label } },
  };
}

const TOWNS = 12;

/** Site n's one photo, usable (CC BY 4.0, 1600 × 1200). */
const sitePhoto = (n: number) => ({
  title: `File:Site ${n}.jpg`,
  imageinfo: [
    {
      width: 1600,
      height: 1200,
      url: `https://upload.wikimedia.org/site-${n}.jpg`,
      thumburl: `https://upload.wikimedia.org/1280px-site-${n}.jpg`,
      thumbwidth: 1280,
      thumbheight: 960,
      extmetadata: {
        Artist: { value: `Photographer ${n}` },
        LicenseShortName: { value: 'CC BY 4.0' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0' },
      },
    },
  ],
});

function world(): WikimediaFixtures {
  const f = readFixtures();
  const extra: Record<string, unknown> = {
    Q884: { ...entity('Q884', 'South Korea', 'Q884', 36, 128), claims: {} },
    Q16520: entity('Q16520', 'Busan', 'Q884', 35.18, 129.08),
  };
  const sparql: Record<string, boolean> = { [settlementQuery('Q16520')]: true };
  const imageinfo: WikimediaFixtures['imageinfo'] = {};
  for (let n = 1; n <= TOWNS; n++) {
    extra[`Q800${n}`] = entity(`Q800${n}`, `Town ${n}`, 'Q17', 35 + n / 10, 135);
    const site = entity(`Q810${n}`, `Site ${n}`, 'Q17', 35 + n / 10, 136);
    extra[`Q810${n}`] = { ...site, claims: { ...site.claims, P18: [st(`Site ${n}.jpg`)] } };
    imageinfo[`File:Site ${n}.jpg`] = sitePhoto(n);
    sparql[settlementQuery(`Q800${n}`)] = true;
    sparql[settlementQuery(`Q810${n}`)] = false;
  }
  return {
    ...f,
    entities: { ...f.entities, ...(extra as WikimediaFixtures['entities']) },
    sparql: { ...f.sparql, ...sparql },
    imageinfo: { ...f.imageinfo, ...imageinfo },
  };
}

const wikimedia = () => createFakeWikimediaClient(world());
const photoDir = mkdtempSync(join(tmpdir(), 'pinpoint-photos-'));

// ---- Writer and checker stubs ----

const place = (name: string, fact = `A fine fact about place number ${name.length}.`) => ({
  name,
  country: 'Japan',
  enwiki: name,
  fact,
});
const towns = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => place(`Town ${from + i}`));
const sites = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => place(`Site ${from + i}`));

const spend = (searches = 0): Usage => ({ ...emptyUsage(), searches, costUsd: 0.01 });

type Round = Partial<Omit<WriteResult, 'usage'>>;

/** Answers each write with the next scripted round (then nothing), recording the requests. */
function scriptedWriter(rounds: Round[]): PlaceWriter & { requests: WriteRequest[] } {
  const requests: WriteRequest[] = [];
  return {
    requests,
    write(request) {
      requests.push(structuredClone(request));
      const r = rounds[requests.length - 1] ?? {};
      return Promise.resolve({ cities: [], landmarks: [], ...r, usage: spend() });
    },
  };
}

/** Keeps every place unless told to drop or fix it by name; spends `searches` per call. */
function stubChecker(
  rules: Record<string, { drop?: string; fact?: string; displayName?: string }> = {},
  searches = 0,
): PlaceChecker & { calls: { items: CheckItem[]; maxSearches: number }[] } {
  const calls: { items: CheckItem[]; maxSearches: number }[] = [];
  return {
    calls,
    check(items, { maxSearches }) {
      calls.push({ items: [...items], maxSearches });
      const verdicts = items.map(({ id, name }) => {
        const rule = rules[name];
        if (rule?.drop) return { id, verdict: 'drop', reason: rule.drop };
        if (rule) return { id, verdict: 'fix', ...rule, reason: 'fixed' };
        return { id, verdict: 'ok', reason: 'fine' };
      });
      return Promise.resolve({ verdicts, usage: spend(searches) });
    },
  };
}

const request = (over: Partial<LevelRequest> = {}): LevelRequest => ({
  category: 'Japan',
  guidance: '',
  level: 'easy',
  count: 5,
  meta: { box: JAPAN, labelStyle: 'city' },
  avoid: [],
  existingIds: new Set(),
  ...over,
});

const names = (places: { name: string; kind: PlaceKind }[], kind: PlaceKind) =>
  places.filter((p) => p.kind === kind).map((p) => p.name);

// ---- Tests ----

describe('generateLevel', () => {
  it('drops places by reason: writer, Locate, checker and a fact repeating the name', async () => {
    const writer = scriptedWriter([
      {
        cities: [
          place('Kyoto'),
          place('Atlantis'), // not on Wikidata
          place('Sapporo'), // outside Kansai
          place('Town 1', 'x'.repeat(91)),
          { name: 'Town 2' }, // no fact
          place('Town 3', 'Town 3 has a famous fish market.'),
          place('Town 4'),
        ],
        landmarks: [place('Himeji Castle'), place('Osaka')],
      },
    ]);
    const checker = stubChecker({ 'Town 4': { drop: 'Wrong entity' } });
    const result = await generateLevel(request({ meta: { box: KANSAI, labelStyle: 'city' } }), {
      generator: { writer, checker },
      wikimedia: wikimedia(),
      photoDir,
    });
    expect(result.dropped).toEqual(
      expect.arrayContaining([
        { kind: 'city', name: 'Atlantis', reason: DROP.notFound },
        { kind: 'city', name: 'Sapporo', reason: DROP.outside },
        { kind: 'city', name: 'Town 1', reason: PIPELINE_DROP.factTooLong },
        { kind: 'city', name: 'Town 2', reason: PIPELINE_DROP.malformed },
        { kind: 'city', name: 'Town 3', reason: PIPELINE_DROP.repeatsName },
        { kind: 'city', name: 'Town 4', reason: 'Wrong entity' },
        { kind: 'landmark', name: 'Osaka', reason: DROP.settlement },
      ]),
    );
    expect(names(result.places, 'city')).toEqual(['Kyoto']);
    expect(names(result.places, 'landmark')).toEqual(['Himeji Castle']);
  });

  it('drops a place already in the category or written twice in the level', async () => {
    const writer = scriptedWriter([
      { cities: [place('Osaka'), place('Kyoto'), place('Kyoto')], landmarks: sites(1, 2) },
    ]);
    const result = await generateLevel(request({ count: 2, existingIds: new Set(['Q35765']) }), {
      generator: { writer, checker: stubChecker() },
      wikimedia: wikimedia(),
      photoDir,
    });
    expect(result.dropped).toEqual([
      { kind: 'city', name: 'Osaka', reason: DROP.duplicate },
      { kind: 'city', name: 'Kyoto', reason: DROP.duplicate },
    ]);
    expect(names(result.places, 'city')).toEqual(['Kyoto']);
  });

  it('tops up only the short mode, avoiding every name written so far', async () => {
    const writer = scriptedWriter([
      { cities: towns(1, 7), landmarks: sites(1, 7) },
      { cities: towns(8, 9), landmarks: sites(8, 9) },
    ]);
    const checker = stubChecker({
      'Town 1': { drop: 'Not famous' },
      'Town 2': { drop: 'Not famous' },
      'Town 3': { drop: 'Not famous' },
    });
    const stages: LevelStage[] = [];
    const result = await generateLevel(request(), {
      generator: { writer, checker },
      wikimedia: wikimedia(),
      photoDir,
      onStage: (s) => stages.push(s),
    });

    expect(writer.requests).toHaveLength(2);
    expect(writer.requests[1]).toMatchObject({ count: 1, box: JAPAN, first: false });
    expect(writer.requests[1]!.avoid).toEqual([
      ...towns(1, 7).map((t) => t.name),
      ...sites(1, 7).map((s) => s.name),
    ]);
    // The top-up's landmarks are ignored: that mode was already full.
    expect(checker.calls[1]!.items.map((i) => i.name)).toEqual(['Town 8', 'Town 9']);
    expect(names(result.places, 'city')).toEqual([
      'Town 4',
      'Town 5',
      'Town 6',
      'Town 7',
      'Town 8',
    ]);
    expect(result.short).toBeUndefined();
    expect(stages).toEqual(['write', 'locate', 'check', 'photos', 'replace']);
  });

  it('stops after 2 top-up rounds and saves the level short', async () => {
    const writer = scriptedWriter([
      { cities: towns(1, 3), landmarks: sites(1, 7) },
      { cities: towns(4, 4) },
      { cities: [] },
      { cities: towns(5, 9) }, // never asked for
    ]);
    const result = await generateLevel(request(), {
      generator: { writer, checker: stubChecker() },
      wikimedia: wikimedia(),
      photoDir,
    });
    expect(writer.requests).toHaveLength(3);
    expect(names(result.places, 'city')).toHaveLength(4);
    expect(result.short).toEqual({ city: 5 });
    expect(shortText(result)).toEqual(['4 of 5 cities']);

    const store = new CategoryStore([]);
    const saved = await saveLevel(store, { name: 'Japan' }, 'easy', result);
    expect(saved.draft.easy).toMatchObject({ reviewed: false, short: { city: 5 } });
    expect(shortText(saved.draft.easy!)).toEqual(['4 of 5 cities']);
  });

  it("keeps the writer's order and trims each mode to count", async () => {
    const writer = scriptedWriter([{ cities: towns(1, 7), landmarks: sites(1, 7) }]);
    const result = await generateLevel(request(), {
      generator: { writer, checker: stubChecker() },
      wikimedia: wikimedia(),
      photoDir,
    });
    expect(result.places.map((p) => p.name)).toEqual([
      ...towns(1, 5).map((t) => t.name),
      ...sites(1, 5).map((s) => s.name),
    ]);
    expect(result.short).toBeUndefined();
    expect(new Set(result.places.map((p) => p.id)).size).toBe(10);
    expect(result.places[0]).not.toHaveProperty('description');
  });

  it('stores a photo for each kept landmark, and only as many as the level needs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pinpoint-photos-'));
    const download = vi.fn(createFakeWikimediaClient(world()).download);
    const writer = scriptedWriter([{ cities: [], landmarks: sites(1, 3) }]);
    const result = await generateLevel(request({ count: 2, only: 'landmark' }), {
      generator: { writer, checker: stubChecker() },
      wikimedia: { ...wikimedia(), download },
      photoDir: dir,
    });
    expect(names(result.places, 'landmark')).toEqual(['Site 1', 'Site 2']);
    expect(download).toHaveBeenCalledTimes(2); // Site 3 would be trimmed: no download
    const [first] = result.places;
    expect(first!.photo).toEqual({
      id: expect.stringMatching(/^[\w-]{20}$/),
      width: 1280,
      height: 960,
      author: 'Photographer 1',
      licence: 'CC BY 4.0',
      licenceUrl: 'https://creativecommons.org/licenses/by/4.0',
      commonsFile: 'File:Site 1.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Site_1.jpg',
    });
    expect(first!.photoCandidates).toEqual([]);
    expect(readdirSync(dir).sort()).toEqual(
      result.places.flatMap((p) => [`${p.photo!.id}-thumb.webp`, `${p.photo!.id}.webp`]).sort(),
    );
  });

  it('drops a landmark with no usable photo, and tops up for it', async () => {
    const f = world();
    // Site 2's only photo is GFDL.
    const gfdl = sitePhoto(2);
    gfdl.imageinfo[0]!.extmetadata.LicenseShortName.value = 'GFDL';
    const client = createFakeWikimediaClient({
      ...f,
      imageinfo: { ...f.imageinfo, 'File:Site 2.jpg': gfdl },
    });
    const writer = scriptedWriter([
      { cities: [], landmarks: sites(1, 2) },
      { cities: [], landmarks: sites(3, 3) },
    ]);
    const result = await generateLevel(request({ count: 2, only: 'landmark' }), {
      generator: { writer, checker: stubChecker() },
      wikimedia: client,
      photoDir,
    });
    expect(result.dropped).toEqual([{ kind: 'landmark', name: 'Site 2', reason: DROP.noPhoto }]);
    expect(names(result.places, 'landmark')).toEqual(['Site 1', 'Site 3']);
    expect(result.places.every((p) => p.photo)).toBe(true);
  });

  it('locates no more than ceil(count × 1.25) of a mode', async () => {
    const writer = scriptedWriter([{ cities: towns(1, 12), landmarks: sites(1, 12) }]);
    const checker = stubChecker();
    await generateLevel(request({ count: 4 }), {
      generator: { writer, checker },
      wikimedia: wikimedia(),
      photoDir,
    });
    expect(checker.calls[0]!.items).toHaveLength(10);
  });

  it('gives the checker the searches the level has left', async () => {
    const writer = scriptedWriter([
      { cities: towns(1, 3), landmarks: sites(1, 7) },
      { cities: towns(4, 7) },
    ]);
    const checker = stubChecker({}, 4);
    await generateLevel(request(), {
      generator: { writer, checker },
      wikimedia: wikimedia(),
      photoDir,
    });
    expect(checker.calls.map((c) => c.maxSearches)).toEqual([
      GENERATE_SEARCHES_MAX,
      GENERATE_SEARCHES_MAX - 4,
    ]);
  });

  it("applies a checker's fix and keeps a fixed display name as the admin's", async () => {
    const writer = scriptedWriter([{ cities: [place('Kyoto')], landmarks: [] }]);
    const checker = stubChecker({
      Kyoto: { fact: 'Has about 1,600 Buddhist temples.', displayName: 'Kyōto' },
    });
    const result = await generateLevel(request({ count: 5 }), {
      generator: { writer, checker },
      wikimedia: wikimedia(),
      photoDir,
    });
    expect(result.places[0]).toMatchObject({
      fact: 'Has about 1,600 Buddhist temples.',
      displayName: 'Kyōto',
      autoDisplayName: false,
    });
  });

  describe('a first level', () => {
    it("takes the writer's box and emoji and sets the label style to city for one country", async () => {
      const writer = scriptedWriter([
        {
          cities: [place('Osaka'), place('Kyoto')],
          landmarks: [place('Himeji Castle')],
          box: JAPAN,
          emoji: '🗾',
          labelStyle: 'cityCountry',
        },
      ]);
      const result = await generateLevel(request({ meta: null }), {
        generator: { writer, checker: stubChecker() },
        wikimedia: wikimedia(),
        photoDir,
      });
      expect(writer.requests[0]).toMatchObject({ first: true, box: null });
      expect(writer.requests[1]).toMatchObject({ first: false, box: JAPAN });
      expect(result).toMatchObject({ box: JAPAN, emoji: '🗾', labelStyle: 'city' });
      expect(result.places.map((p) => p.displayName)).toEqual(['Osaka', 'Kyoto', 'Himeji Castle']);
    });

    it('sets cityCountry when the places span countries', async () => {
      const writer = scriptedWriter([
        {
          cities: [place('Osaka'), { ...place('Busan'), country: 'South Korea' }],
          landmarks: [],
          box: JAPAN,
          emoji: 'not an emoji',
          labelStyle: 'city',
        },
      ]);
      const result = await generateLevel(request({ meta: null }), {
        generator: { writer, checker: stubChecker() },
        wikimedia: wikimedia(),
        photoDir,
      });
      expect(result.labelStyle).toBe('cityCountry');
      expect(result.emoji).toBeNull();
      expect(result.places.map((p) => p.displayName)).toEqual([
        'Osaka, Japan',
        'Busan, South Korea',
      ]);
    });

    it("keeps a later level's label style whatever its countries", async () => {
      const writer = scriptedWriter([{ cities: [place('Osaka')], landmarks: [] }]);
      const result = await generateLevel(
        request({ meta: { box: JAPAN, labelStyle: 'cityCountry' } }),
        { generator: { writer, checker: stubChecker() }, wikimedia: wikimedia(), photoDir },
      );
      expect(result.labelStyle).toBe('cityCountry');
      expect(result.places[0]!.displayName).toBe('Osaka, Japan');
    });

    it('fails with its spend when the writer gives no usable box', async () => {
      for (const box of [undefined, { south: 34, west: 135, north: 34.5, east: 135.5 }]) {
        const writer = scriptedWriter([{ cities: [place('Osaka')], landmarks: [], box }]);
        const failed = generateLevel(request({ meta: null }), {
          generator: { writer, checker: stubChecker() },
          wikimedia: wikimedia(),
          photoDir,
        });
        await expect(failed).rejects.toMatchObject({ message: NO_BOX, usage: { costUsd: 0.01 } });
      }
    });

    it('is saved as a new category with its box, label style and emoji, as an unreviewed draft', async () => {
      const writer = scriptedWriter([
        { cities: [place('Osaka')], landmarks: [], box: JAPAN, emoji: '🗾', labelStyle: 'city' },
      ]);
      const result = await generateLevel(request({ meta: null }), {
        generator: { writer, checker: stubChecker() },
        wikimedia: wikimedia(),
        photoDir,
      });
      const store = new CategoryStore([]);
      const saved = await saveLevel(store, { name: 'Japan' }, 'easy', result);
      expect(saved).toMatchObject({ id: 'japan', box: JAPAN, labelStyle: 'city', emoji: '🗾' });
      expect(saved.draft.easy).toMatchObject({ reviewed: false, short: { city: 5, landmark: 5 } });
      expect(saved.draft.easy!.places.map((p) => p.name)).toEqual(['Osaka']);
      expect(store.summaries()).toEqual([]); // a draft only

      const again = await saveLevel(store, { id: 'japan' }, 'medium', result);
      expect(Object.keys(again.draft)).toEqual(['easy', 'medium']);
    });
  });

  it("ends the level with Wikidata's outage message and the spend so far", async () => {
    const down: WikimediaClient = {
      ...wikimedia(),
      entitiesByTitle: () => Promise.reject(new WikimediaError('Wikidata answered HTTP 503', 503)),
    };
    const writer = scriptedWriter([{ cities: [place('Osaka')], landmarks: [] }]);
    const failed = generateLevel(request(), {
      generator: { writer, checker: stubChecker() },
      wikimedia: down,
      photoDir,
    });
    await expect(failed).rejects.toThrow(GenerationError);
    await expect(failed).rejects.toMatchObject({
      message: WIKIDATA_DOWN,
      usage: { costUsd: 0.01 },
    });
  });

  it("adds a failed checker's spend to the level's", async () => {
    const writer = scriptedWriter([{ cities: [place('Osaka')], landmarks: [] }]);
    const checker: PlaceChecker = {
      check: () => Promise.reject(new GenerationError('Claude is overloaded.', spend())),
    };
    await expect(
      generateLevel(request(), {
        generator: { writer, checker },
        wikimedia: wikimedia(),
        photoDir,
      }),
    ).rejects.toMatchObject({ message: 'Claude is overloaded.', usage: { costUsd: 0.02 } });
  });

  it('lets a cancel through as itself', async () => {
    const controller = new AbortController();
    const cancelled = new DOMException('Cancelled', 'AbortError');
    const writer: PlaceWriter = {
      write: () => {
        controller.abort(cancelled);
        return Promise.reject(cancelled);
      },
    };
    await expect(
      generateLevel(request(), {
        generator: { writer, checker: stubChecker() },
        wikimedia: wikimedia(),
        photoDir,
        signal: controller.signal,
      }),
    ).rejects.toBe(cancelled);
  });

  it('writes, locates and checks only the one mode a replacement asks for', async () => {
    const writer = scriptedWriter([{ cities: towns(1, 2), landmarks: sites(1, 2) }]);
    const checker = stubChecker();
    const result = await generateLevel(request({ count: 1, only: 'landmark' }), {
      generator: { writer, checker },
      wikimedia: wikimedia(),
      photoDir,
    });
    expect(result.places.map((p) => p.name)).toEqual(['Site 1']);
    expect(checker.calls[0]!.items.map((i) => i.name)).toEqual(['Site 1', 'Site 2']);
    expect(result.short).toBeUndefined();
    expect(writer.requests).toHaveLength(1);
  });

  it('reports the places kept so far per mode after each check', async () => {
    const writer = scriptedWriter([
      { cities: towns(1, 2), landmarks: sites(1, 1) },
      { landmarks: sites(2, 3) },
    ]);
    const kept: Record<PlaceKind, number>[] = [];
    await generateLevel(request({ count: 2 }), {
      generator: { writer, checker: stubChecker() },
      wikimedia: wikimedia(),
      photoDir,
      onKept: (k) => kept.push(k),
    });
    expect(kept).toEqual([
      { city: 2, landmark: 1 },
      { city: 2, landmark: 2 },
    ]);
  });

  it('runs on the fake generator and fake Wikimedia with no network', async () => {
    const result = await generateLevel(request({ meta: null }), {
      generator: fakeGenerator(),
      wikimedia: createFakeWikimediaClient(),
      photoDir,
    });
    expect(result).toMatchObject({
      box: FAKE_BOX,
      emoji: FAKE_EMOJI,
      labelStyle: 'city',
      short: { city: 5, landmark: 5 },
    });
    expect(names(result.places, 'city')).toEqual(['Osaka', 'Kyoto', 'Sapporo']);
    expect(names(result.places, 'landmark')).toEqual(['Himeji Castle', 'Tokyo Tower']);
    expect(shortText(result)).toEqual(['3 of 5 cities', '2 of 5 landmarks']);
  });
});

describe('repeatsName', () => {
  it('matches the name as whole words, ignoring case, accents and punctuation', () => {
    expect(repeatsName('Kyōto served as capital.', 'Kyoto')).toBe(true);
    expect(repeatsName('Home of the Tokyo-Tower replica.', 'Tokyo Tower')).toBe(true);
    expect(repeatsName('A nice place.', 'Ni')).toBe(false);
    expect(repeatsName('Served as the imperial capital.', 'Kyoto')).toBe(false);
  });
});

describe('inferLabelStyle', () => {
  it('is city for one country, cityCountry for several, and none for no places', () => {
    expect(inferLabelStyle([{ countryId: 'Q17' }, { countryId: 'Q17' }])).toBe('city');
    expect(inferLabelStyle([{ countryId: 'Q17' }, { countryId: 'Q884' }])).toBe('cityCountry');
    expect(inferLabelStyle([])).toBeNull();
  });
});
