// The resolver (spec: Wikidata and Commons resolution, steps 1–7; City display text): turns one
// writer item into a place with Wikidata's coordinates and country, or a drop with its reason.
// It reads the Wikimedia client's raw answers through zod, since they come from outside. A failed
// or malformed answer throws a WikimediaError, which fails the level (spec: Provider outages).

import { z } from 'zod';
import {
  COUNTRY_SHORT_NAMES,
  PHOTO_AUTHOR_MAX,
  PHOTO_CANDIDATES_MAX,
  PLACE_NAME_MAX,
} from '#shared/constants.js';
import { boxContains, regionScale } from '#shared/geo.js';
import type {
  Box,
  LabelStyle,
  Place,
  PhotoCandidate,
  PlaceKind,
  WikidataCandidate,
} from '#shared/types.js';
import { autoDisplayName } from '../categoryStore.js';
import {
  WikimediaError,
  depictsSearch,
  isWikimediaFileUrl,
  normalizeTitle,
  settlementQuery,
  type WikimediaClient,
} from './wikimedia.js';

/** One item as the writer gives it (spec: Generation pipeline, Write). */
export interface WriterItem {
  name: string;
  country: string;
  enwiki: string;
  fact: string;
}

export interface ResolveContext {
  kind: PlaceKind;
  /** The box the level is generated for (the draft box when there is one). */
  box: Box;
  labelStyle: LabelStyle;
  /** Q-ids already in the category, any level. */
  existingIds: ReadonlySet<string>;
}

/** A located place, before it gets an id (and, for a landmark, a photo). */
export type ResolvedPlace = Omit<Place, 'id' | 'photo' | 'photoCandidates'> & {
  /** Wikidata's English description, for the checker. */
  description: string;
};

export type Resolution = { place: ResolvedPlace } | { drop: string };

export const DROP = {
  notFound: 'Not found on Wikidata',
  noCoordinates: 'No coordinates on Wikidata',
  country: 'Disputed or unclear country',
  notCity: 'Not a city',
  settlement: 'Is a settlement, not a landmark',
  outside: 'Outside the box',
  tooLarge: 'Too large to pin',
  duplicate: 'Already in the category',
  noPhoto: 'No usable photo',
} as const;

const SOVEREIGN_STATE = 'Q3624078';
const END_TIME = 'P582';

// ---- Wikidata's shapes ----

const statementSchema = z.object({
  rank: z.enum(['preferred', 'normal', 'deprecated']),
  mainsnak: z.object({ datavalue: z.object({ value: z.unknown() }).optional() }),
  qualifiers: z.record(z.string(), z.array(z.unknown())).optional(),
});
type Statement = z.infer<typeof statementSchema>;

const entitySchema = z.object({
  id: z.string(),
  labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
  descriptions: z.record(z.string(), z.object({ value: z.string() })).optional(),
  claims: z.record(z.string(), z.array(statementSchema)).optional(),
  sitelinks: z.record(z.string(), z.unknown()).optional(),
});
type Entity = z.infer<typeof entitySchema>;

const entitiesSchema = z.object({
  entities: z.record(z.string(), z.union([z.object({ missing: z.string() }), entitySchema])),
});
const searchSchema = z.object({ search: z.array(z.object({ id: z.string() })) });
const askSchema = z.object({ boolean: z.boolean() });
const itemValue = z.object({ id: z.string() });
const coordValue = z.object({ latitude: z.number(), longitude: z.number() });
const quantityValue = z.object({ amount: z.string(), unit: z.string() });

// ---- Commons' shapes (formatversion=2) ----

const fileListSchema = z.object({
  query: z
    .object({
      search: z.array(z.object({ title: z.string() })).optional(),
      categorymembers: z.array(z.object({ title: z.string() })).optional(),
    })
    .optional(),
});
const imageInfoSchema = z.object({
  query: z
    .object({
      pages: z.array(
        z.object({
          title: z.string(),
          imageinfo: z
            .array(
              z.object({
                width: z.number(),
                height: z.number(),
                url: z.string().optional(),
                thumburl: z.string().optional(),
                extmetadata: z.record(z.string(), z.object({ value: z.unknown() })).optional(),
              }),
            )
            .optional(),
        }),
      ),
    })
    .optional(),
});

function parse<T>(schema: z.ZodType<T>, answer: unknown): T {
  const result = schema.safeParse(answer);
  if (!result.success) throw new WikimediaError('Wikidata answered in an unexpected shape');
  return result.data;
}

const found = (answer: unknown): Entity[] =>
  Object.values(parse(entitiesSchema, answer).entities).filter(
    (e): e is Entity => !('missing' in e),
  );

/** The statement's value, when it is one (not "no value" or "unknown value") and fits `schema`. */
function value<T>(statement: Statement, schema: z.ZodType<T>): T | null {
  const result = schema.safeParse(statement.mainsnak.datavalue?.value);
  return result.success ? result.data : null;
}

/** The preferred-rank value, else the first normal-rank one (P625, P2046). */
function bestValue<T>(entity: Entity, property: string, schema: z.ZodType<T>): T | null {
  const statements = entity.claims?.[property] ?? [];
  for (const rank of ['preferred', 'normal'] as const) {
    for (const s of statements) {
      const v = s.rank === rank ? value(s, schema) : null;
      if (v) return v;
    }
  }
  return null;
}

/** P17: the preferred values, else the normal ones without an end time; null unless exactly one. */
function countryOf(entity: Entity): string | null {
  const statements = entity.claims?.P17 ?? [];
  const preferred = statements.filter((s) => s.rank === 'preferred');
  const chosen = preferred.length
    ? preferred
    : statements.filter((s) => s.rank === 'normal' && !s.qualifiers?.[END_TIME]?.length);
  const ids = new Set(chosen.flatMap((s) => value(s, itemValue)?.id ?? []));
  return ids.size === 1 ? [...ids][0]! : null;
}

const instanceOf = (entity: Entity): string[] =>
  (entity.claims?.P31 ?? []).flatMap((s) =>
    s.rank === 'deprecated' ? [] : (value(s, itemValue)?.id ?? []),
  );

const coordinatesOf = (entity: Entity) => {
  const c = bestValue(entity, 'P625', coordValue);
  return c && { lat: c.latitude, lng: c.longitude };
};

const sitelinkCount = (entity: Entity) => Object.keys(entity.sitelinks ?? {}).length;

// ---- Units and names ----

/** km² per unit, by the unit's Wikidata entity. */
const KM2_PER_UNIT: Record<string, number> = {
  Q712226: 1, // square kilometre
  Q25343: 1e-6, // square metre
  Q35852: 0.01, // hectare
  Q232291: 2.589988110336, // square mile
  Q81292: 0.0040468564224, // acre
};

/** A P2046 quantity in km², or null for a unit not in the table. */
export function areaKm2(quantity: { amount: string; unit: string }): number | null {
  const factor = KM2_PER_UNIT[quantity.unit.split('/').pop()!];
  const amount = Number(quantity.amount);
  return factor === undefined || !Number.isFinite(amount) ? null : amount * factor;
}

/** The largest landmark area kept: `(0.01 × S)²` km². */
export function maxLandmarkAreaKm2(box: Box): number {
  return (0.01 * regionScale(box)) ** 2;
}

export function countryShortName(label: string): string {
  return COUNTRY_SHORT_NAMES[label] ?? label;
}

/** Photos step 2: the longer side a usable candidate needs. */
export const PHOTO_MIN_PX = 800;

const CC_URL = {
  zero: 'https://creativecommons.org/publicdomain/zero/1.0/',
  mark: 'https://creativecommons.org/publicdomain/mark/1.0/',
};

/**
 * Photos step 2's allow-list on `LicenseShortName`: CC0, a public-domain mark, CC BY or CC BY-SA
 * (any version, any port). Everything else (GFDL, NC, ND, unknown) is refused.
 */
export function freeLicence(short: string): 'zero' | 'mark' | 'by' | null {
  const s = short.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^cc0( 1\.0)?( universal)?$/.test(s)) return 'zero';
  if (/^(public domain( mark( 1\.0)?)?|pdm( 1\.0)?)$/.test(s)) return 'mark';
  if (/^cc[ -]by(-sa)?([ -]\d(\.\d)?)?( [a-z]{2,3}(-[a-z]+)?)?$/.test(s)) return 'by';
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** `Artist` as plain text: tags out, entities decoded, spaces collapsed, ≤ 120 characters. */
export function plainAuthor(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? whole;
      const n =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return (text || 'Unknown author').slice(0, PHOTO_AUTHOR_MAX).trim();
}

/** An https licence URL, `//…` and `http://…` upgraded; null when there is none to give. */
function httpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const url = new URL(
      raw
        .trim()
        .replace(/^\/\//, 'https://')
        .replace(/^http:/i, 'https:'),
    );
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// ---- The resolver ----

export function createResolver(client: WikimediaClient) {
  /** Country Q-id → English label (null: no label); a level's places mostly share a few. */
  const labels = new Map<string, string | null>();

  async function countryLabels(ids: string[]): Promise<void> {
    const wanted = [...new Set(ids)].filter((id) => !labels.has(id));
    if (!wanted.length) return;
    const entities = found(await client.entitiesById(wanted));
    for (const id of wanted) {
      labels.set(id, entities.find((e) => e.id === id)?.labels?.en?.value ?? null);
    }
  }

  /** Step 1: the enwiki title, else the search on the name, filtered by country and box. */
  async function find(item: WriterItem, box: Box): Promise<Entity | null> {
    const [byTitle] = found(await client.entitiesByTitle(item.enwiki));
    if (byTitle) return byTitle;

    const hits = parse(searchSchema, await client.searchEntities(item.name)).search;
    if (!hits.length) return null;
    const candidates = found(await client.entitiesById(hits.map((h) => h.id)));
    await countryLabels(candidates.flatMap((e) => countryOf(e) ?? []));
    const kept = candidates.filter((e) => {
      const country = countryOf(e);
      const label = country && labels.get(country);
      const at = coordinatesOf(e);
      return (
        label &&
        (same(label, item.country) || same(countryShortName(label), item.country)) &&
        at &&
        boxContains(box, at)
      );
    });
    // The first hit wins a tie: search ranks its best match first.
    return kept.reduce<Entity | null>(
      (best, e) => (!best || sitelinkCount(e) > sitelinkCount(best) ? e : best),
      null,
    );
  }

  async function resolve(item: WriterItem, ctx: ResolveContext): Promise<Resolution> {
    const entity = await find(item, ctx.box);
    return entity ? check(entity, item.name, item.fact, ctx) : { drop: DROP.notFound };
  }

  /** Add by name: the admin's pick, named by its English label, through the same checks. */
  async function resolveById(qid: string, fact: string, ctx: ResolveContext): Promise<Resolution> {
    const [entity] = found(await client.entitiesById([qid]));
    const label = entity?.labels?.en?.value.trim().slice(0, PLACE_NAME_MAX).trim();
    return entity && label ? check(entity, label, fact, ctx) : { drop: DROP.notFound };
  }

  /** Steps 2–7 on a found entity. */
  async function check(
    entity: Entity,
    rawName: string,
    fact: string,
    ctx: ResolveContext,
  ): Promise<Resolution> {
    const at = coordinatesOf(entity);
    if (!at) return { drop: DROP.noCoordinates };

    const countryId = countryOf(entity);
    if (countryId) await countryLabels([countryId]);
    const countryLabel = countryId && labels.get(countryId);
    if (!countryId || !countryLabel) return { drop: DROP.country };

    if (ctx.kind === 'city') {
      if (instanceOf(entity).includes(SOVEREIGN_STATE)) return { drop: DROP.notCity };
      if (!(await isSettlement(entity.id))) return { drop: DROP.notCity };
    } else if (await isSettlement(entity.id)) {
      return { drop: DROP.settlement };
    }

    if (!boxContains(ctx.box, at)) return { drop: DROP.outside };

    if (ctx.kind === 'landmark') {
      const area = bestValue(entity, 'P2046', quantityValue);
      const km2 = area && areaKm2(area);
      // SPEC-QUESTION: DECISIONS 44 (an area in an unknown unit is not checked)
      if (km2 !== null && km2 > maxLandmarkAreaKm2(ctx.box)) return { drop: DROP.tooLarge };
    }

    if (ctx.existingIds.has(entity.id)) return { drop: DROP.duplicate };

    const name = rawName.trim();
    const place: ResolvedPlace = {
      kind: ctx.kind,
      name,
      displayName: name,
      autoDisplayName: true,
      fact: fact.trim(),
      lat: at.lat,
      lng: at.lng,
      coordsSource: 'wikidata',
      wikidataId: entity.id,
      countryId,
      countryName: countryShortName(countryLabel),
      description: entity.descriptions?.en?.value ?? '',
    };
    place.displayName = autoDisplayName({ ...place, id: '' }, ctx.labelStyle);
    return { place };
  }

  /** Add by name's list: up to 7 search hits with description, country and coordinates. */
  async function searchCandidates(q: string): Promise<WikidataCandidate[]> {
    const hits = parse(searchSchema, await client.searchEntities(q)).search;
    if (!hits.length) return [];
    const entities = found(await client.entitiesById(hits.map((h) => h.id)));
    await countryLabels(entities.flatMap((e) => countryOf(e) ?? []));
    return hits.flatMap(({ id }) => {
      const e = entities.find((x) => x.id === id);
      if (!e) return [];
      const country = countryOf(e);
      const label = country ? labels.get(country) : null;
      return {
        wikidataId: e.id,
        name: e.labels?.en?.value ?? e.id,
        description: e.descriptions?.en?.value ?? '',
        country: label ? countryShortName(label) : null,
        ...(coordinatesOf(e) ?? { lat: null, lng: null }),
      };
    });
  }

  /**
   * Photos steps 1–2: up to 6 candidates (P18, then files depicting the item, then its Commons
   * category), each kept when its licence is free and its longer side is at least 800 px.
   */
  async function photoCandidates(qid: string): Promise<PhotoCandidate[]> {
    const [entity] = found(await client.entitiesById([qid]));
    if (!entity) return [];
    const titles: string[] = [];
    const add = (names: readonly string[]) => {
      for (const name of names) {
        const title = normalizeTitle(name.startsWith('File:') ? name : `File:${name}`);
        if (titles.length < PHOTO_CANDIDATES_MAX && !titles.includes(title)) titles.push(title);
      }
    };
    const strings = (property: string) =>
      (entity.claims?.[property] ?? [])
        .filter((st) => st.rank !== 'deprecated')
        .sort((a, b) => (a.rank === 'preferred' ? 0 : 1) - (b.rank === 'preferred' ? 0 : 1))
        .flatMap((st) => value(st, z.string()) ?? []);
    add(strings('P18'));
    if (titles.length < PHOTO_CANDIDATES_MAX) {
      const answer = parse(fileListSchema, await client.searchFiles(depictsSearch(qid)));
      add((answer.query?.search ?? []).map((f) => f.title));
    }
    const [category] = strings('P373');
    if (titles.length < PHOTO_CANDIDATES_MAX && category) {
      const answer = parse(fileListSchema, await client.categoryFiles(category));
      add((answer.query?.categorymembers ?? []).map((f) => f.title));
    }
    if (!titles.length) return [];

    const pages = parse(imageInfoSchema, await client.imageInfo(titles)).query?.pages ?? [];
    return titles.flatMap((title): PhotoCandidate[] => {
      const info = pages.find((p) => normalizeTitle(p.title) === title)?.imageinfo?.[0];
      if (!info) return [];
      const meta = (key: string) => info.extmetadata?.[key]?.value;
      const shortName = meta('LicenseShortName');
      const licence = typeof shortName === 'string' ? freeLicence(shortName) : null;
      const licenceUrl =
        httpsUrl(meta('LicenseUrl')) ??
        (licence === 'zero' || licence === 'mark' ? CC_URL[licence] : null);
      const thumbUrl = info.thumburl ?? info.url;
      if (
        !licence ||
        !licenceUrl ||
        Math.max(info.width, info.height) < PHOTO_MIN_PX ||
        !thumbUrl ||
        !isWikimediaFileUrl(thumbUrl)
      ) {
        return [];
      }
      return [
        {
          commonsFile: title,
          thumbUrl,
          author: plainAuthor(typeof meta('Artist') === 'string' ? (meta('Artist') as string) : ''),
          licence: (shortName as string).trim().slice(0, 60),
          licenceUrl,
          width: info.width,
          height: info.height,
        },
      ];
    });
  }

  async function isSettlement(qid: string): Promise<boolean> {
    return parse(askSchema, await client.ask(settlementQuery(qid))).boolean;
  }

  return { resolve, resolveById, searchCandidates, photoCandidates };
}
