// The built-in starter sets: 20 categories at Easy (100 points), Medium (200) and Hard (300),
// 15 questions each, for Filipino game nights (DECISIONS, starter plan). Each JSON file holds one
// category's three sets in that order, in the set file shape that Import JSON accepts.

import { questionSetSchema } from '../schemas.js';
import type { QuestionSet } from '../types.js';
import animals from './animals.json' with { type: 'json' };
import anime from './anime.json' with { type: 'json' };
import comics from './comics.json' with { type: 'json' };
import food from './food.json' with { type: 'json' };
import health from './health.json' with { type: 'json' };
import language from './language.json' with { type: 'json' };
import movies from './movies.json' with { type: 'json' };
import music from './music.json' with { type: 'json' };
import mythology from './mythology.json' with { type: 'json' };
import phGeography from './ph-geography.json' with { type: 'json' };
import phHistory from './ph-history.json' with { type: 'json' };
import phPopCulture from './ph-pop-culture.json' with { type: 'json' };
import religion from './religion.json' with { type: 'json' };
import science from './science.json' with { type: 'json' };
import space from './space.json' with { type: 'json' };
import sports from './sports.json' with { type: 'json' };
import tech from './tech.json' with { type: 'json' };
import videoGames from './video-games.json' with { type: 'json' };
import worldGeography from './world-geography.json' with { type: 'json' };
import worldHistory from './world-history.json' with { type: 'json' };

/** Category slugs in list order. A set's id is `starter-<slug>-<easy|medium|hard>`. */
export const STARTER_CATEGORIES = [
  'animals',
  'movies',
  'ph-history',
  'world-history',
  'science',
  'religion',
  'tech',
  'comics',
  'anime',
  'video-games',
  'food',
  'ph-geography',
  'world-geography',
  'music',
  'sports',
  'ph-pop-culture',
  'health',
  'space',
  'mythology',
  'language',
] as const;

export type StarterCategory = (typeof STARTER_CATEGORIES)[number];

// JSON imports widen literals (`schemaVersion` reads as number), so the files are parsed with
// questionSetSchema below rather than cast: a bad edit fails at import, not in a seeded database.
const FILES: Record<StarterCategory, unknown> = {
  animals,
  movies,
  'ph-history': phHistory,
  'world-history': worldHistory,
  science,
  religion,
  tech,
  comics,
  anime,
  'video-games': videoGames,
  food,
  'ph-geography': phGeography,
  'world-geography': worldGeography,
  music,
  sports,
  'ph-pop-culture': phPopCulture,
  health,
  space,
  mythology,
  language,
};

/** All 60 starter sets: categories in list order, Easy, Medium, Hard within each. */
export const STARTER_SETS: QuestionSet[] = questionSetSchema
  .array()
  .parse(STARTER_CATEGORIES.flatMap((slug) => FILES[slug]));
