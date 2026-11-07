import { describe, expect, it, vi } from 'vitest';
import type { Box, LabelStyle, PlaceKind } from '#shared/types.js';
import {
  createFakeWikimediaClient,
  readFixtures,
  type WikimediaFixtures,
} from './fakeWikimedia.js';
import {
  areaKm2,
  countryShortName,
  createResolver,
  maxLandmarkAreaKm2,
  type ResolveContext,
  type WriterItem,
} from './resolver.js';
import { WikimediaError, settlementQuery, type WikimediaClient } from './wikimedia.js';

const JAPAN: Box = { south: 24, west: 122, north: 46, east: 146 };
const KANSAI: Box = { south: 33.5, west: 134, north: 36, east: 137 };
const SOUTH_AMERICA: Box = { south: -56, west: -82, north: 13, east: -34 };
/** Fiji and Tonga: crosses the antimeridian (`east` > 180). */
const FIJI: Box = { south: -25, west: 170, north: -10, east: 190 };

type Rank = 'preferred' | 'normal' | 'deprecated';
type Statement = { rank?: Rank; value: unknown; ended?: boolean };

const st = ({ rank = 'normal', value, ended }: Statement) => ({
  rank,
  type: 'statement',
  mainsnak: { snaktype: 'value', datavalue: { value } },
  ...(ended
    ? { qualifiers: { P582: [{ snaktype: 'value', datavalue: { value: { time: '+2001' } } }] } }
    : {}),
});
const item = (id: string) => ({ 'entity-type': 'item', id });
const at = (latitude: number, longitude: number) => ({ latitude, longitude, globe: 'Q2' });

/** A test-only entity in `wbgetentities` shape. */
function entity(
  id: string,
  e: {
    label: string;
    enwiki?: string;
    p31?: string[];
    p17?: Statement[];
    p625?: Statement[];
    p2046?: { amount: string; unit: string }[];
    sitelinks?: number;
  },
) {
  const sitelinks: Record<string, { site: string; title: string }> = {};
  if (e.enwiki) sitelinks.enwiki = { site: 'enwiki', title: e.enwiki };
  for (let i = Object.keys(sitelinks).length; i < (e.sitelinks ?? 1); i++) {
    sitelinks[`x${i}wiki`] = { site: `x${i}wiki`, title: e.label };
  }
  return {
    type: 'item',
    id,
    labels: { en: { language: 'en', value: e.label } },
    descriptions: { en: { language: 'en', value: `test ${e.label}` } },
    claims: {
      P31: (e.p31 ?? []).map((q) => st({ value: item(q) })),
      P17: (e.p17 ?? []).map((s) => st({ ...s, value: item(s.value as string) })),
      P625: (e.p625 ?? []).map(st),
      P2046: (e.p2046 ?? []).map((value) => st({ value })),
    },
    sitelinks,
  };
}

const KM2 = 'http://www.wikidata.org/entity/Q712226';
const HECTARE = 'http://www.wikidata.org/entity/Q35852';
const CITY = 'Q515';

/** The F35 fixtures plus test-only entities for the cases real places don't show. */
function fixtures(): WikimediaFixtures {
  const f = readFixtures();
  const extra = {
    Q30: entity('Q30', { label: 'United States of America', p31: ['Q3624078'] }),
    Q29: entity('Q29', { label: 'Spain' }),
    Q717: entity('Q717', { label: 'Venezuela' }),
    Q712: entity('Q712', { label: 'Fiji' }),
    Q16635: entity('Q16635', { label: 'Guam' }),
    Q900001: entity('Q900001', {
      label: 'Austin',
      enwiki: 'Austin, Texas',
      p31: [CITY],
      p17: [{ value: 'Q30' }],
      p625: [{ value: at(30.27, -97.74) }],
    }),
    // Coordinates: a deprecated value first, then a normal one, then the preferred one.
    Q900002: entity('Q900002', {
      label: 'Ranked',
      enwiki: 'Ranked',
      p31: [CITY],
      p17: [{ value: 'Q17' }],
      p625: [
        { rank: 'deprecated', value: at(10, 10) },
        { value: at(35.1, 135.1) },
        { rank: 'preferred', value: at(35.2, 135.2) },
        { value: at(35.3, 135.3) },
      ],
    }),
    Q900003: entity('Q900003', {
      label: 'First normal',
      enwiki: 'First normal',
      p31: [CITY],
      p17: [{ value: 'Q17' }],
      p625: [
        { rank: 'deprecated', value: at(10, 10) },
        { value: at(35.4, 135.4) },
        { value: at(35.5, 135.5) },
      ],
    }),
    Q900004: entity('Q900004', {
      label: 'Nowhere',
      enwiki: 'Nowhere',
      p31: [CITY],
      p17: [{ value: 'Q17' }],
    }),
    // Country: the preferred value wins over normal ones.
    Q900005: entity('Q900005', {
      label: 'Preferred country',
      enwiki: 'Preferred country',
      p31: [CITY],
      p17: [{ value: 'Q30' }, { rank: 'preferred', value: 'Q17' }],
      p625: [{ value: at(35, 135) }],
    }),
    // Country: an ended normal value is ignored, leaving one.
    Q900006: entity('Q900006', {
      label: 'Changed country',
      enwiki: 'Changed country',
      p31: [CITY],
      p17: [{ value: 'Q30', ended: true }, { value: 'Q17' }],
      p625: [{ value: at(35, 135) }],
    }),
    Q900007: entity('Q900007', {
      label: 'Disputed',
      enwiki: 'Disputed',
      p31: [CITY],
      p17: [{ value: 'Q30' }, { value: 'Q17' }],
      p625: [{ value: at(35, 135) }],
    }),
    Q900008: entity('Q900008', {
      label: 'Stateless',
      enwiki: 'Stateless',
      p31: [CITY],
      p17: [
        { value: 'Q30', ended: true },
        { rank: 'deprecated', value: 'Q17' },
      ],
      p625: [{ value: at(35, 135) }],
    }),
    // A city-state: a settlement by ASK, and a sovereign state.
    Q900009: entity('Q900009', {
      label: 'Citystate',
      enwiki: 'Citystate',
      p31: ['Q3624078', CITY],
      p17: [{ value: 'Q900009' }],
      p625: [{ value: at(35, 135) }],
    }),
    Q900010: entity('Q900010', {
      label: 'Huge Site',
      enwiki: 'Huge Site',
      p31: ['Q570116'],
      p17: [{ value: 'Q17' }],
      p625: [{ value: at(35, 135) }],
      p2046: [{ amount: '+60000', unit: HECTARE }],
    }),
    Q900011: entity('Q900011', {
      label: 'Odd Unit Site',
      enwiki: 'Odd Unit Site',
      p31: ['Q570116'],
      p17: [{ value: 'Q17' }],
      p625: [{ value: at(35, 135) }],
      p2046: [{ amount: '+999999', unit: 'http://www.wikidata.org/entity/Q1' }],
    }),
    Q900012: entity('Q900012', {
      label: 'Big City',
      enwiki: 'Big City',
      p31: [CITY],
      p17: [{ value: 'Q17' }],
      p625: [{ value: at(35, 135) }],
      p2046: [{ amount: '+2000', unit: KM2 }],
    }),
    Q900013: entity('Q900013', {
      label: 'Nukualofa',
      enwiki: 'Nukualofa',
      p31: [CITY],
      p17: [{ value: 'Q712' }],
      p625: [{ value: at(-21.14, -175.2) }],
    }),
    Q900014: entity('Q900014', {
      label: 'Hagatna',
      enwiki: 'Hagatna',
      p31: [CITY],
      p17: [{ value: 'Q16635' }],
      p625: [{ value: at(13.47, 144.75) }],
    }),
    // Valencia: the best-known one is in Spain; the Venezuelan ones differ by box and sitelinks.
    Q900020: entity('Q900020', {
      label: 'Valencia',
      p31: [CITY],
      p17: [{ value: 'Q29' }],
      p625: [{ value: at(39.47, -0.38) }],
      sitelinks: 40,
    }),
    Q900021: entity('Q900021', {
      label: 'Valencia',
      p31: [CITY],
      p17: [{ value: 'Q717' }],
      p625: [{ value: at(10.18, -68.0) }],
      sitelinks: 12,
    }),
    Q900022: entity('Q900022', {
      label: 'Valencia (mis-placed)',
      p31: [CITY],
      p17: [{ value: 'Q717' }],
      p625: [{ value: at(40, 0) }],
      sitelinks: 20,
    }),
    Q900023: entity('Q900023', {
      label: 'Valencia Municipality',
      p31: ['Q2198484'],
      p17: [{ value: 'Q717' }],
      p625: [{ value: at(10.1, -68.1) }],
      sitelinks: 3,
    }),
  };
  Object.assign(f.entities, extra);
  f.search.entities.Valencia = ['Q900020', 'Q900021', 'Q900022', 'Q900023'].map((id) => ({ id }));
  f.search.entities.Atlantis = [{ id: 'Q900020' }];
  f.search.entities.Austin = [{ id: 'Q900001' }];
  for (const [id, yes] of Object.entries({
    Q900001: true,
    Q900002: true,
    Q900003: true,
    Q900005: true,
    Q900006: true,
    Q900009: true,
    Q900010: false,
    Q900011: false,
    Q900012: true,
    Q900013: true,
    Q900014: true,
    Q900021: true,
  })) {
    f.sparql[settlementQuery(id)] = yes;
  }
  return f;
}

function setup() {
  const client = createFakeWikimediaClient(fixtures());
  const entitiesById = vi.spyOn(client, 'entitiesById');
  const ask = vi.spyOn(client, 'ask');
  return { resolve: createResolver(client).resolve, entitiesById, ask };
}

const w = (name: string, enwiki = name, country = 'Japan'): WriterItem => ({
  name,
  country,
  enwiki,
  fact: `A fact about ${name}`,
});
const ctx = (
  kind: PlaceKind = 'city',
  box: Box = JAPAN,
  labelStyle: LabelStyle = 'city',
  existingIds: string[] = [],
): ResolveContext => ({ kind, box, labelStyle, existingIds: new Set(existingIds) });

describe('resolver: finding the item', () => {
  it('resolves a city by its English Wikipedia title', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Osaka'), ctx())).toEqual({
      place: {
        kind: 'city',
        name: 'Osaka',
        displayName: 'Osaka',
        autoDisplayName: true,
        fact: 'A fact about Osaka',
        lat: 34.693889,
        lng: 135.502222,
        coordsSource: 'wikidata',
        wikidataId: 'Q35765',
        countryId: 'Q17',
        countryName: 'Japan',
        description: 'designated city in Kansai, Japan',
      },
    });
  });

  it('falls back to search on the name: the most sitelinks wins', async () => {
    const { resolve } = setup();
    const result = await resolve(w('Osaka', 'Osaka (no such article)'), ctx());
    // Osaka Prefecture is in Japan and the box too, with fewer sitelinks.
    expect(result).toMatchObject({ place: { wikidataId: 'Q35765' } });
  });

  it('keeps only search candidates in the named country and inside the box', async () => {
    const { resolve } = setup();
    // Spain's Valencia has the most sitelinks (wrong country); one Venezuelan hit lies outside the
    // box; of the two left, the city has more sitelinks than the municipality.
    const result = await resolve(
      w('Valencia', 'Valencia (no such article)', 'Venezuela'),
      ctx('city', SOUTH_AMERICA, 'cityCountry'),
    );
    expect(result).toMatchObject({
      place: {
        wikidataId: 'Q900021',
        displayName: 'Valencia, Venezuela',
        countryName: 'Venezuela',
      },
    });
  });

  it('matches the country by its short name too', async () => {
    const { resolve } = setup();
    const result = await resolve(w('Austin', 'Austin (no such article)', 'United States'), {
      ...ctx('city', { south: 20, west: -130, north: 50, east: -60 }, 'cityCountry'),
    });
    expect(result).toMatchObject({ place: { displayName: 'Austin, United States' } });
  });

  it('drops an item neither the title nor the search finds', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Nowhere Town', 'Nowhere Town'), ctx())).toEqual({
      drop: 'Not found on Wikidata',
    });
    // A search hit in the wrong country is no match either.
    expect(await resolve(w('Atlantis', 'Atlantis (no such article)'), ctx())).toEqual({
      drop: 'Not found on Wikidata',
    });
  });

  it('turns a malformed answer into a WikimediaError', async () => {
    const client = createFakeWikimediaClient(fixtures());
    const broken: WikimediaClient = { ...client, entitiesByTitle: async () => ({ nope: 1 }) };
    await expect(createResolver(broken).resolve(w('Osaka'), ctx())).rejects.toBeInstanceOf(
      WikimediaError,
    );
  });
});

describe('resolver: coordinates and country', () => {
  it('takes the preferred-rank coordinates, else the first normal-rank ones', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Ranked'), ctx())).toMatchObject({ place: { lat: 35.2, lng: 135.2 } });
    expect(await resolve(w('First normal'), ctx())).toMatchObject({
      place: { lat: 35.4, lng: 135.4 },
    });
  });

  it('drops an item without P625', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Nowhere'), ctx())).toEqual({ drop: 'No coordinates on Wikidata' });
  });

  it('takes the preferred country, else the normal ones without an end time', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Preferred country'), ctx())).toMatchObject({
      place: { countryId: 'Q17', countryName: 'Japan' },
    });
    expect(await resolve(w('Changed country'), ctx())).toMatchObject({
      place: { countryId: 'Q17' },
    });
  });

  it('drops an item with two current countries or none', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Disputed'), ctx())).toEqual({ drop: 'Disputed or unclear country' });
    expect(await resolve(w('Stateless'), ctx())).toEqual({ drop: 'Disputed or unclear country' });
  });

  it('asks Wikidata for each country label once per resolver', async () => {
    const { resolve, entitiesById } = setup();
    await resolve(w('Osaka'), ctx());
    await resolve(w('Kyoto'), ctx());
    expect(entitiesById.mock.calls.filter(([ids]) => ids.includes('Q17'))).toHaveLength(1);
  });
});

describe('resolver: type', () => {
  it('drops a city that is not a settlement', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Osaka Prefecture'), ctx())).toEqual({ drop: 'Not a city' });
    expect(await resolve(w('Himeji Castle'), ctx())).toEqual({ drop: 'Not a city' });
  });

  it('drops a sovereign state as a city, even when it is a settlement', async () => {
    const { resolve, ask } = setup();
    expect(await resolve(w('Citystate'), ctx())).toEqual({ drop: 'Not a city' });
    expect(ask).not.toHaveBeenCalled();
  });

  it('drops a settlement offered as a landmark', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Kyoto'), ctx('landmark'))).toEqual({
      drop: 'Is a settlement, not a landmark',
    });
  });

  it('resolves a landmark with its own name as the display name in either style', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Himeji Castle'), ctx('landmark', JAPAN, 'cityCountry'))).toMatchObject({
      place: { kind: 'landmark', wikidataId: 'Q188754', displayName: 'Himeji Castle' },
    });
  });
});

describe('resolver: box, size and duplicates', () => {
  it('drops a place outside the box', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Sapporo'), ctx('city', KANSAI))).toEqual({ drop: 'Outside the box' });
    expect(await resolve(w('Kyoto'), ctx('city', KANSAI))).toMatchObject({
      place: { wikidataId: 'Q34600' },
    });
  });

  it('handles a box across the antimeridian', async () => {
    const { resolve } = setup();
    // Nuku'alofa at −175.2° lies in [170, 190] as 184.8°; it keeps its stored −175.2.
    expect(await resolve(w('Nukualofa', 'Nukualofa', 'Fiji'), ctx('city', FIJI))).toMatchObject({
      place: { lng: -175.2, lat: -21.14 },
    });
    expect(await resolve(w('Hagatna', 'Hagatna', 'Guam'), ctx('city', FIJI))).toEqual({
      drop: 'Outside the box',
    });
  });

  it('drops a landmark larger than (0.01 × S)² km², converting the unit', async () => {
    const { resolve } = setup();
    // Japan's box: S ≈ 2,313 km, so the limit is ≈ 535 km²; 60,000 ha is 600 km².
    expect(maxLandmarkAreaKm2(JAPAN)).toBeCloseTo(535, 0);
    expect(await resolve(w('Huge Site'), ctx('landmark'))).toEqual({ drop: 'Too large to pin' });
    // Himeji Castle's 1.07 km² is fine; so is an area in a unit the resolver doesn't know.
    expect(await resolve(w('Himeji Castle'), ctx('landmark'))).toHaveProperty('place');
    expect(await resolve(w('Odd Unit Site'), ctx('landmark'))).toHaveProperty('place');
    // The size rule is for landmarks only.
    expect(await resolve(w('Big City'), ctx('city'))).toHaveProperty('place');
  });

  it('converts the area units Wikidata uses', () => {
    const q = (id: string) => `http://www.wikidata.org/entity/${id}`;
    expect(areaKm2({ amount: '+3', unit: q('Q712226') })).toBe(3);
    expect(areaKm2({ amount: '+2500000', unit: q('Q25343') })).toBe(2.5);
    expect(areaKm2({ amount: '+150', unit: q('Q35852') })).toBe(1.5);
    expect(areaKm2({ amount: '+1', unit: q('Q232291') })).toBeCloseTo(2.59, 2);
    expect(areaKm2({ amount: '+640', unit: q('Q81292') })).toBeCloseTo(2.59, 2);
    expect(areaKm2({ amount: '+1', unit: '1' })).toBeNull();
  });

  it('drops an item already in the category', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Osaka'), ctx('city', JAPAN, 'city', ['Q35765']))).toEqual({
      drop: 'Already in the category',
    });
  });
});

describe('resolver: display names', () => {
  it('uses the name for the city style and "name, country" for cityCountry', async () => {
    const { resolve } = setup();
    expect(await resolve(w('Kyoto'), ctx('city', JAPAN, 'city'))).toMatchObject({
      place: { displayName: 'Kyoto' },
    });
    expect(await resolve(w('Kyoto'), ctx('city', JAPAN, 'cityCountry'))).toMatchObject({
      place: { displayName: 'Kyoto, Japan' },
    });
  });

  it('falls back to the name when "name, country" passes 40 characters', async () => {
    const { resolve } = setup();
    const long = { ...w('Osaka'), name: 'Osaka the Great Merchant City of Kansai' };
    expect(await resolve(long, ctx('city', JAPAN, 'cityCountry'))).toMatchObject({
      place: { displayName: 'Osaka the Great Merchant City of Kansai' },
    });
  });

  it('shortens country labels with the override table', () => {
    expect(countryShortName('United States of America')).toBe('United States');
    expect(countryShortName('Democratic Republic of the Congo')).toBe('DR Congo');
    expect(countryShortName('Czech Republic')).toBe('Czechia');
    expect(countryShortName('Japan')).toBe('Japan');
  });
});
