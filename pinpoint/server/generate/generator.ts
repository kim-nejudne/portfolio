// The three model steps of generation (spec: Generation pipeline), behind interfaces as in Buzzr's
// `generator.ts`, so the pipeline and its tests run on fakes (`fake.ts`). The writer is F39's, the
// checker F40's and the sign checker F47's; this file only fixes their shapes. Replies are raw
// (`unknown`), parsed with zod by the caller, because model output is a trust boundary.

import type { Box, Difficulty, PlaceKind } from '#shared/types.js';
import type { Usage } from './pricing.js';

export interface WriteRequest {
  /** The category's name, such as "Japan". */
  category: string;
  /** The admin's guidance; '' when none. */
  guidance: string;
  level: Difficulty;
  /** The category's box, or null when a new category has none yet. */
  box: Box | null;
  /** Places wanted per mode; the writer asks for `ceil(count × 1.25)`. */
  count: number;
  /** Every place name already in the category, any level, either kind. */
  avoid: readonly string[];
  /** A new category's first level: also ask for its box, emoji and label style. */
  first: boolean;
}

export interface WriteResult {
  cities: unknown[];
  landmarks: unknown[];
  /** Only on a first level. */
  box?: unknown;
  emoji?: unknown;
  labelStyle?: unknown;
  usage: Usage;
}

export interface PlaceWriter {
  /** Throws a GenerationError on a refusal or an API error. */
  write(request: WriteRequest, signal?: AbortSignal): Promise<WriteResult>;
}

/** A place as the checker sees it, with an id to answer by. */
export interface CheckItem {
  id: string;
  kind: PlaceKind;
  name: string;
  displayName: string;
  wikidataId: string;
  description: string;
  country: string;
  lat: number;
  lng: number;
  fact: string;
}

export interface PlaceChecker {
  /** Raw verdicts (`ok`, `fix` or `drop` with a reason). Throws a GenerationError on an API error. */
  check(
    items: readonly CheckItem[],
    options: { level: Difficulty; maxSearches: number },
    signal?: AbortSignal,
  ): Promise<{ verdicts: unknown[]; usage: Usage }>;
}

export interface SignCheckRequest {
  /** The Commons file name; the real checker ignores it, the fake reads it. */
  commonsFile: string;
  /** The 480 px thumbnail. */
  image: Uint8Array;
  mediaType: string;
  name: string;
  country: string;
}

export interface SignChecker {
  /** Whether visible text names or strongly hints at the place. */
  check(
    request: SignCheckRequest,
    signal?: AbortSignal,
  ): Promise<{ flagged: boolean; usage: Usage }>;
}

export interface Generator {
  writer: PlaceWriter;
  checker: PlaceChecker;
  signChecker: SignChecker;
  /** `GENERATE_FAKE=1`: no API call, no spend. */
  fake: boolean;
}

/**
 * A failed step, with a message fit to show the admin and the usage spent before it failed.
 * Show or log only `message`: `cause` may hold the SDK's error and the API's own text.
 */
export class GenerationError extends Error {
  constructor(
    message: string,
    readonly usage: Usage,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'GenerationError';
  }
}
