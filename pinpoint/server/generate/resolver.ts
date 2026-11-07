// The resolver (spec: Wikidata and Commons resolution, steps 1–7; City display text): turns one
// writer item into a place with Wikidata's coordinates and country, or a drop with its reason.
// It reads the Wikimedia client's raw answers through zod, since they come from outside. A failed
// or malformed answer throws a WikimediaError, which fails the level (spec: Provider outages).

import { z } from 'zod';
import { COUNTRY_SHORT_NAMES } from '#shared/constants.js';
import { boxContains, regionScale } from '#shared/geo.js';
import type { Box, LabelStyle, Place, PlaceKind } from '#shared/types.js';
import { autoDisplayName } from '../categoryStore.js';
import { WikimediaError, settlementQuery, type WikimediaClient } from './wikimedia.js';

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
    if (!entity) return { drop: DROP.notFound };

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

    const name = item.name.trim();
    const place: ResolvedPlace = {
      kind: ctx.kind,
      name,
      displayName: name,
      autoDisplayName: true,
      fact: item.fact.trim(),
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

  async function isSettlement(qid: string): Promise<boolean> {
    return parse(askSchema, await client.ask(settlementQuery(qid))).boolean;
  }

  return { resolve };
}
