// One generated level (spec: Generation pipeline), ported from Buzzr's `generateLevel`: Write →
// Locate → Check, then up to GENERATE_EXTRA_ROUNDS top-up rounds for whichever mode is short.
// Photos (M6) slot in after Check. The writer, checker and Wikimedia client are injected, so tests
// and GENERATE_FAKE=1 run on fakes. Every model reply is parsed here; a bad item is a drop.

import { randomBytes } from 'node:crypto';
import { FACT_MAX, PLACE_NAME_MAX } from '#shared/constants.js';
import { boxTooSmall } from '#shared/geo.js';
import type {
  Box,
  Category,
  Difficulty,
  LabelStyle,
  LevelContent,
  Place,
  PlaceKind,
} from '#shared/types.js';
import { autoDisplayName, type CategoryStore } from '../categoryStore.js';
import { judge } from './checker.js';
import { GenerationError, type CheckItem, type Generator } from './generator.js';
import { type Usage, addUsage, emptyUsage } from './pricing.js';
import { createResolver, type ResolvedPlace } from './resolver.js';
import { WikimediaError, type WikimediaClient } from './wikimedia.js';
import { askedCount, writerFirstLevelSchema, writerItemSchema } from './writer.js';

export const GENERATE_EXTRA_ROUNDS = 2;
/** Web searches the checker may spend on one level, across its rounds. */
export const GENERATE_SEARCHES_MAX = 10;

export const WIKIDATA_DOWN = "Wikidata isn't answering. Try again later.";
export const NO_BOX =
  'Claude gave no usable box for this region. Try again, or name the region more plainly.';
export const PIPELINE_DROP = {
  factTooLong: `Fact over ${FACT_MAX} characters`,
  malformed: 'Malformed place from the writer',
  repeatsName: 'The fact repeats the name',
} as const;

const KINDS = ['city', 'landmark'] as const;

/** The progress steps (spec: Generate page); top-up rounds are all "replace". */
export type LevelStage = 'write' | 'locate' | 'check' | 'replace';

export interface LevelRequest {
  category: string;
  guidance: string;
  level: Difficulty;
  /** Places wanted per mode. */
  count: number;
  /** The category's draft box and label style; null for a new category's first level. */
  meta: { box: Box; labelStyle: LabelStyle } | null;
  /** Every place name already in the category, any level, either kind. */
  avoid: readonly string[];
  /** Every Q-id already in the category, any level. */
  existingIds: ReadonlySet<string>;
}

export interface Drop {
  kind: PlaceKind;
  name: string;
  reason: string;
}

export interface LevelResult {
  /** Cities then landmarks, each in the writer's order, at most `count` of each. */
  places: Place[];
  /** The asked-for count of each mode that came out short. */
  short?: LevelContent['short'];
  dropped: Drop[];
  usage: Usage;
  /** The box and label style the level was made for; a first level's come from the writer and Locate. */
  box: Box;
  labelStyle: LabelStyle;
  /** A first level's proposed emoji, when valid. */
  emoji: string | null;
}

export interface LevelDeps {
  generator: Pick<Generator, 'writer' | 'checker'>;
  wikimedia: WikimediaClient;
  onStage?: (stage: LevelStage) => void;
  signal?: AbortSignal;
}

/** Case, accents and punctuation aside, as whole words. */
const words = (text: string) =>
  ` ${text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;

/** The writer is told a fact must not repeat the name; neither its schema nor `judge` checks. */
export function repeatsName(fact: string, name: string): boolean {
  const n = words(name);
  return n.trim() !== '' && words(fact).includes(n);
}

/** City display text: one country across the level's places → `city`; none → no answer. */
export function inferLabelStyle(places: readonly { countryId: string }[]): LabelStyle | null {
  const countries = new Set(places.map((p) => p.countryId));
  if (countries.size === 0) return null;
  return countries.size === 1 ? 'city' : 'cityCountry';
}

function rawDrop(kind: PlaceKind, raw: unknown): Drop {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, PLACE_NAME_MAX) : '';
  const longFact = typeof r.fact === 'string' && r.fact.trim().length > FACT_MAX;
  return {
    kind,
    name: name || '?',
    reason: longFact ? PIPELINE_DROP.factTooLong : PIPELINE_DROP.malformed,
  };
}

// SPEC-QUESTION: DECISIONS 49 (short counts, label style on a first level only, the box check, name repeats, top-up counts)
export async function generateLevel(request: LevelRequest, deps: LevelDeps): Promise<LevelResult> {
  const { writer, checker } = deps.generator;
  const resolver = createResolver(deps.wikimedia);
  const first = request.meta === null;
  let box = request.meta?.box ?? null;
  let labelStyle: LabelStyle = request.meta?.labelStyle ?? 'cityCountry';
  let emoji: string | null = null;
  const accepted: Record<PlaceKind, ResolvedPlace[]> = { city: [], landmark: [] };
  const dropped: Drop[] = [];
  const avoid = [...request.avoid];
  const existingIds = new Set(request.existingIds);
  let usage = emptyUsage();
  let nextId = 1;

  try {
    for (let round = 0; round <= GENERATE_EXTRA_ROUNDS; round++) {
      const need = {
        city: request.count - accepted.city.length,
        landmark: request.count - accepted.landmark.length,
      };
      if (need.city <= 0 && need.landmark <= 0) break;

      // Write
      deps.onStage?.(round === 0 ? 'write' : 'replace');
      const written = await writer.write(
        {
          category: request.category,
          guidance: request.guidance,
          level: request.level,
          box,
          count: Math.max(need.city, need.landmark),
          avoid: [...avoid],
          first: box === null,
        },
        deps.signal,
      );
      usage = addUsage(usage, written.usage);
      if (box === null) {
        const proposed = writerFirstLevelSchema.shape.box.safeParse(written.box);
        // Its usage is already counted above.
        if (!proposed.success || boxTooSmall(proposed.data)) {
          throw new GenerationError(NO_BOX, emptyUsage());
        }
        box = proposed.data;
        labelStyle =
          writerFirstLevelSchema.shape.labelStyle.safeParse(written.labelStyle).data ?? labelStyle;
        emoji = writerFirstLevelSchema.shape.emoji.safeParse(written.emoji).data ?? null;
      }

      // Locate; a mode that is already full ignores what was written for it.
      if (round === 0) deps.onStage?.('locate');
      const located: ResolvedPlace[] = [];
      for (const kind of KINDS) {
        if (need[kind] <= 0) continue;
        const raws = kind === 'city' ? written.cities : written.landmarks;
        for (const raw of raws.slice(0, askedCount(need[kind]))) {
          const item = writerItemSchema.safeParse(raw);
          if (!item.success) {
            dropped.push(rawDrop(kind, raw));
            continue;
          }
          avoid.push(item.data.name);
          const found = await resolver.resolve(item.data, { kind, box, labelStyle, existingIds });
          if ('drop' in found) {
            dropped.push({ kind, name: item.data.name, reason: found.drop });
            continue;
          }
          existingIds.add(found.place.wikidataId);
          located.push(found.place);
        }
      }
      if (located.length === 0) continue;

      // Check
      if (round === 0) deps.onStage?.('check');
      const items: CheckItem[] = located.map((p) => ({
        id: `p${nextId++}`,
        kind: p.kind,
        name: p.name,
        displayName: p.displayName,
        wikidataId: p.wikidataId,
        description: p.description,
        country: p.countryName,
        lat: p.lat,
        lng: p.lng,
        fact: p.fact,
      }));
      const byId = new Map(items.map((item, i) => [item.id, located[i]!]));
      const checked = await checker.check(
        items,
        { level: request.level, maxSearches: Math.max(0, GENERATE_SEARCHES_MAX - usage.searches) },
        deps.signal,
      );
      usage = addUsage(usage, checked.usage);
      const judged = judge(items, checked.verdicts);
      for (const { item, reason } of judged.dropped) {
        dropped.push({ kind: item.kind, name: item.name, reason });
      }
      for (const item of judged.kept) {
        if (repeatsName(item.fact, item.name)) {
          dropped.push({ kind: item.kind, name: item.name, reason: PIPELINE_DROP.repeatsName });
          continue;
        }
        const place = byId.get(item.id)!;
        accepted[item.kind].push({
          ...place,
          fact: item.fact,
          displayName: item.displayName,
          autoDisplayName: place.autoDisplayName && item.displayName === place.displayName,
        });
      }
    }
  } catch (err) {
    // A cancel (F42) stays a cancel, not a failure.
    if (deps.signal?.aborted) throw err;
    if (err instanceof WikimediaError) {
      throw new GenerationError(WIKIDATA_DOWN, usage, { cause: err });
    }
    if (err instanceof GenerationError) {
      throw new GenerationError(err.message, addUsage(usage, err.usage), { cause: err });
    }
    throw new GenerationError('Generation failed unexpectedly. Try again.', usage, { cause: err });
  }

  const kept = KINDS.flatMap((kind) => accepted[kind].slice(0, request.count));
  if (first) labelStyle = inferLabelStyle(kept) ?? labelStyle;
  const places = kept.map((p): Place => {
    const place: Place & { description?: string } = {
      ...p,
      id: randomBytes(15).toString('base64url'),
    };
    delete place.description; // the checker's, not stored
    if (place.autoDisplayName) place.displayName = autoDisplayName(place, labelStyle);
    return place;
  });
  const short: NonNullable<LevelContent['short']> = {};
  for (const kind of KINDS) {
    if (accepted[kind].length < request.count) short[kind] = request.count;
  }

  return {
    places,
    ...(Object.keys(short).length ? { short } : {}),
    dropped,
    usage,
    // A first level that wrote nothing valid has thrown NO_BOX, so `box` is set.
    box: box!,
    labelStyle,
    emoji,
  };
}

/**
 * Saves a generated level as an unreviewed draft. A new category (`{name}`) is created first with
 * the level's box, label style and emoji.
 */
export async function saveLevel(
  store: CategoryStore,
  target: { id: string } | { name: string },
  level: Difficulty,
  result: LevelResult,
): Promise<Category> {
  const id =
    'id' in target
      ? target.id
      : (
          await store.create({
            name: target.name,
            emoji: result.emoji,
            box: result.box,
            labelStyle: result.labelStyle,
          })
        ).id;
  return store.saveDraftLevel(id, level, {
    places: result.places,
    ...(result.short ? { short: result.short } : {}),
  });
}
