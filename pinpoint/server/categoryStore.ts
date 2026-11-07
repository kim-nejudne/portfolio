import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DISPLAY_NAME_MAX } from '#shared/constants.js';
import { boxContains, boxTooSmall } from '#shared/geo.js';
import { draftBoxAndStyle, publishProblems } from '#shared/publish.js';
import { categoriesFileSchema, placeSchema } from '#shared/schemas.js';
import type {
  AdminCategoryRow,
  AdminLevelRow,
  Box,
  CategoriesFile,
  Category,
  CategoryLevelCounts,
  CategorySummary,
  Difficulty,
  LabelStyle,
  LevelContent,
  Photo,
  Place,
} from '#shared/types.js';

export { draftBoxAndStyle, publishProblems };

/** Read at runtime (not imported), so the fixture never lands in the production bundle. */
const DEV_FIXTURE = new URL('./fixtures/dev-world.json', import.meta.url);
const CATEGORIES_FILE = 'categories.json';

/** Live means at least one published level with places; hidden ones are never offered. */
function isLiveVisible(c: Category): boolean {
  return !c.hidden && Object.values(c.live).some((level) => level.places.length > 0);
}

function summarise(c: Category): CategorySummary {
  const counts: Partial<Record<Difficulty, CategoryLevelCounts>> = {};
  for (const [level, content] of Object.entries(c.live) as [
    Difficulty,
    Category['live'][Difficulty],
  ][]) {
    if (!content) continue;
    counts[level] = countKinds(content);
  }
  return { id: c.id, name: c.name, emoji: c.emoji, box: c.box, labelStyle: c.labelStyle, counts };
}

/** A refused admin change. `status` is the HTTP status the admin route answers with. */
export class CategoryStoreError extends Error {
  override name = 'CategoryStoreError';
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 422 = 400,
  ) {
    super(message);
  }
}

/** A place's automatic display name (spec: City display text). Landmarks show their own name. */
export function autoDisplayName(place: Place, style: LabelStyle): string {
  if (place.kind === 'landmark' || style === 'city') return place.name.slice(0, DISPLAY_NAME_MAX);
  const full = `${place.name}, ${place.countryName}`;
  // SPEC-QUESTION: DECISIONS 37 (a "City, Country" over 40 characters falls back to the city)
  return full.length <= DISPLAY_NAME_MAX ? full : place.name.slice(0, DISPLAY_NAME_MAX);
}

function rewriteAutoNames(levels: Category['live'], style: LabelStyle): void {
  for (const level of Object.values(levels)) {
    for (const p of level.places) if (p.autoDisplayName) p.displayName = autoDisplayName(p, style);
  }
}

function countKinds(level: LevelContent): CategoryLevelCounts {
  return {
    city: level.places.filter((p) => p.kind === 'city').length,
    landmark: level.places.filter((p) => p.kind === 'landmark').length,
  };
}

/** A category as the admin list shows it: a draft level stands in for its live one. */
export function adminRow(c: Category): AdminCategoryRow {
  const level = (d: Difficulty): AdminLevelRow => {
    const draft = c.draft[d];
    const published = c.live[d] !== undefined;
    if (draft) {
      return { state: draft.reviewed ? 'draft' : 'review', published, ...countKinds(draft) };
    }
    const live = c.live[d];
    return live
      ? { state: 'live', published, ...countKinds(live) }
      : { state: 'missing', published, city: 0, landmark: 0 };
  };
  return {
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    hidden: c.hidden,
    levels: { easy: level('easy'), medium: level('medium'), hard: level('hard') },
  };
}

const LEVEL_NAMES: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** Lower-case ASCII words joined by `-`, at most 60 characters. */
function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'category';
}

export interface PlaceEdit {
  name?: string;
  displayName?: string;
  fact?: string;
  lat?: number;
  lng?: number;
  /** The downloaded photo of a picked candidate (the photo feature downloads it). */
  photo?: Photo;
}

export interface CategoryStoreOptions {
  /** `DATA_DIR/categories.json`; without it changes stay in memory (tests, the dev default). */
  file?: string;
  /** Categories never written to the file: the dev fixture. */
  unsavedIds?: readonly string[];
  now?: () => number;
}

/**
 * The stored categories (spec: Stored categories). Every change replaces the changed category
 * with a new object, so a game that read a category keeps what it read, and the next read sees
 * the change. Changes run one at a time and are written atomically before they take effect.
 */
export class CategoryStore {
  private categories: Category[];
  private queue: Promise<unknown> = Promise.resolve();
  private temps = 0;
  private readonly file: string | undefined;
  private readonly unsaved: Set<string>;
  private readonly now: () => number;

  constructor(categories: Category[], options: CategoryStoreOptions = {}) {
    this.categories = categories;
    this.file = options.file;
    this.unsaved = new Set(options.unsavedIds);
    this.now = options.now ?? Date.now;
  }

  /** Live, visible categories for `GET /api/categories`: never places, never drafts. */
  summaries(): CategorySummary[] {
    return this.categories.filter(isLiveVisible).map(summarise);
  }

  /** A live, visible category with its places, or undefined. */
  get(id: string): Category | undefined {
    return this.categories.find((c) => c.id === id && isLiveVisible(c));
  }

  /** Every category with its drafts, for the admin. */
  list(): readonly Category[] {
    return this.categories;
  }

  /** Any category with its drafts, for the admin. */
  find(id: string): Category | undefined {
    return this.categories.find((c) => c.id === id);
  }

  /** A new category with no levels. Its id is the name's slug, made unique with `-2`, `-3`… */
  create(input: {
    name: string;
    emoji: string | null;
    box: Box;
    labelStyle: LabelStyle;
  }): Promise<Category> {
    return this.change((categories) => {
      const base = slugify(input.name);
      let id = base;
      for (let n = 2; categories.some((c) => c.id === id); n++) id = `${base}-${n}`;
      const now = this.now();
      const created: Category = {
        id,
        name: input.name,
        emoji: input.emoji,
        box: { ...input.box },
        labelStyle: input.labelStyle,
        draftMeta: null,
        hidden: false,
        live: {},
        draft: {},
        createdAt: now,
        updatedAt: now,
      };
      return { categories: [...categories, created], result: created };
    });
  }

  /** Saves a generated level as an unreviewed draft over whatever draft it had. */
  saveDraftLevel(
    id: string,
    level: Difficulty,
    content: { places: Place[]; short?: LevelContent['short'] },
  ): Promise<Category> {
    return this.update(id, (c, now) => {
      c.draft[level] = {
        places: structuredClone(content.places),
        reviewed: false,
        ...(content.short ? { short: { ...content.short } } : {}),
        updatedAt: now,
      };
    });
  }

  /**
   * Box and label style. On a category with a live level they go into `draftMeta` and go live on
   * Publish; otherwise into the category itself. A new label style rewrites the draft's automatic
   * display names (live ones follow on Publish).
   */
  updateMeta(id: string, meta: { box?: Box; labelStyle?: LabelStyle }): Promise<Category> {
    return this.update(id, (c) => {
      const tooSmall = meta.box && boxTooSmall(meta.box);
      if (tooSmall) throw new CategoryStoreError(tooSmall);
      const current = draftBoxAndStyle(c);
      const next = {
        box: meta.box ? { ...meta.box } : current.box,
        labelStyle: meta.labelStyle ?? current.labelStyle,
      };
      if (Object.keys(c.live).length > 0) c.draftMeta = next;
      else Object.assign(c, next);
      if (next.labelStyle !== current.labelStyle) rewriteAutoNames(c.draft, next.labelStyle);
    });
  }

  /**
   * Edits a place of the level's draft (forked from the live level when there is none, keeping
   * its reviewed mark). A moved pin must stay inside the draft box and becomes `admin`'s.
   */
  editPlace(id: string, level: Difficulty, placeId: string, edit: PlaceEdit): Promise<Category> {
    return this.update(id, (c, now) => {
      const content = draftLevel(c, level);
      const place = content.places.find((p) => p.id === placeId);
      if (!place) throw new CategoryStoreError('No such place', 404);
      const { box, labelStyle } = draftBoxAndStyle(c);
      if (edit.lat !== undefined || edit.lng !== undefined) {
        const to = { lat: edit.lat ?? place.lat, lng: edit.lng ?? place.lng };
        if (!boxContains(box, to)) throw new CategoryStoreError('The pin must stay inside the box');
        Object.assign(place, to, { coordsSource: 'admin' });
      }
      if (edit.fact !== undefined) place.fact = edit.fact;
      if (edit.photo !== undefined && place.kind === 'landmark') place.photo = { ...edit.photo };
      if (edit.displayName !== undefined && place.kind === 'city') {
        place.displayName = edit.displayName;
        place.autoDisplayName = false;
      }
      if (edit.name !== undefined) {
        place.name = edit.name;
        if (place.kind === 'landmark' || place.autoDisplayName) {
          place.displayName = autoDisplayName(place, labelStyle);
        }
      }
      content.updatedAt = now;
    });
  }

  /**
   * Add by name: a place appended to the level's draft (forked from live when there is none, keeping
   * its reviewed mark), under a new random id. A Q-id already in the category is refused.
   */
  addPlace(id: string, level: Difficulty, place: Omit<Place, 'id'>): Promise<Category> {
    return this.update(id, (c, now) => {
      if (wikidataIds(c).has(place.wikidataId)) {
        throw new CategoryStoreError('Already in the category', 422);
      }
      const content = draftLevel(c, level);
      // Wikidata's text is outside data: never let it make the file unloadable.
      const checked = placeSchema.safeParse({
        ...place,
        id: randomBytes(15).toString('base64url'),
      });
      if (!checked.success)
        throw new CategoryStoreError('Wikidata gave this place a bad field', 422);
      content.places.push(checked.data);
      content.updatedAt = now;
    });
  }

  /** Removes a place from the level's draft (forked from live when there is none). */
  removePlace(id: string, level: Difficulty, placeId: string): Promise<Category> {
    return this.update(id, (c, now) => {
      const content = draftLevel(c, level);
      const at = content.places.findIndex((p) => p.id === placeId);
      if (at < 0) throw new CategoryStoreError('No such place', 404);
      content.places.splice(at, 1);
      content.updatedAt = now;
    });
  }

  /** Marks a draft level reviewed or not; later edits keep the mark. */
  setReviewed(id: string, level: Difficulty, reviewed: boolean): Promise<Category> {
    return this.update(id, (c) => {
      const content = c.draft[level];
      if (!content) throw new CategoryStoreError(`${LEVEL_NAMES[level]} has no draft`, 404);
      content.reviewed = reviewed;
    });
  }

  /** Makes every draft level and the draft meta live at once, or refuses with the problems. */
  publish(id: string): Promise<{ category: Category; levels: number }> {
    let levels = 0;
    return this.update(id, (c) => {
      const problems = publishProblems(c);
      if (problems.length > 0) throw new CategoryStoreError(problems.join('; '), 409);
      levels = Object.keys(c.draft).length;
      Object.assign(c, draftBoxAndStyle(c));
      c.live = { ...c.live, ...c.draft };
      rewriteAutoNames(c.live, c.labelStyle);
      c.draft = {};
      c.draftMeta = null;
    }).then((category) => ({ category, levels }));
  }

  /** A hidden category is not offered in lobbies; a game already using it plays on. */
  setHidden(id: string, hidden: boolean): Promise<Category> {
    return this.update(id, (c) => {
      c.hidden = hidden;
    });
  }

  setEmoji(id: string, emoji: string | null): Promise<Category> {
    return this.update(id, (c) => {
      c.emoji = emoji;
    });
  }

  /** Deletes the category; its photo files go at the next start's clean-up. */
  remove(id: string): Promise<void> {
    return this.change((categories) => {
      if (!categories.some((c) => c.id === id))
        throw new CategoryStoreError('No such category', 404);
      return { categories: categories.filter((c) => c.id !== id), result: undefined };
    });
  }

  /** Applies `edit` to a copy of the category, stamps `updatedAt` and saves. */
  private update(id: string, edit: (c: Category, now: number) => void): Promise<Category> {
    return this.change((categories) => {
      const at = categories.findIndex((c) => c.id === id);
      if (at < 0) throw new CategoryStoreError('No such category', 404);
      const next = structuredClone(categories[at]!);
      const now = this.now();
      edit(next, now);
      next.updatedAt = now;
      return { categories: categories.with(at, next), result: next };
    });
  }

  /** Queues a change: it sees every earlier change, and takes effect only once written. */
  private change<R>(
    apply: (categories: Category[]) => { categories: Category[]; result: R },
  ): Promise<R> {
    const run = this.queue.then(async () => {
      const { categories, result } = apply(this.categories);
      await this.save(categories);
      this.categories = categories;
      return result;
    });
    // A refused or failed change must not block the ones queued behind it.
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Writes beside the file, then renames over it: a crash mid-write leaves the old file whole. */
  private async save(categories: Category[]): Promise<void> {
    if (!this.file) return;
    const file: CategoriesFile = {
      schemaVersion: 1,
      categories: categories.filter((c) => !this.unsaved.has(c.id)),
    };
    // A file the next start would refuse must never be written: it would stop the server.
    const checked = categoriesFileSchema.safeParse(file);
    if (!checked.success) {
      const issue = checked.error.issues[0];
      throw new Error(`Refused to write ${this.file}: ${issue?.path.join('.')}: ${issue?.message}`);
    }
    const temp = `${this.file}.${process.pid}-${++this.temps}.tmp`;
    try {
      // A first start (dev's `./.data`) has no data directory yet.
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(temp, `${JSON.stringify(file, null, 2)}\n`, {
        encoding: 'utf8',
        flush: true,
      });
      await rename(temp, this.file);
    } catch (err) {
      await rm(temp, { force: true }).catch(() => undefined);
      throw err;
    }
  }
}

/** Every Q-id in the category, live and draft, any level. */
export function wikidataIds(c: Category): Set<string> {
  return new Set(
    [...Object.values(c.live), ...Object.values(c.draft)].flatMap((l) =>
      l.places.map((p) => p.wikidataId),
    ),
  );
}

/** The level's draft, forked from the live level (keeping its reviewed mark) when there is none. */
function draftLevel(c: Category, level: Difficulty): LevelContent {
  const live = c.live[level];
  if (!c.draft[level] && live) c.draft[level] = { ...structuredClone(live), reviewed: true };
  const content = c.draft[level];
  if (!content) throw new CategoryStoreError(`${LEVEL_NAMES[level]} has no places`, 404);
  return content;
}

/** Parses a categories file; a bad file throws naming it, which stops the server at start. */
async function readCategoriesFile(path: string | URL): Promise<CategoriesFile | null> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  const name = path instanceof URL ? path.pathname : path;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // No cause: V8's message can quote the file's text, which would reach the startup log.
    throw new Error(`Invalid ${name}: not valid JSON`);
  }
  const result = categoriesFileSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid ${name}: ${problems.join('; ')}`);
  }
  return result.data;
}

/**
 * Deletes `photos/*.webp` files no live or draft place references (spec: Stored categories).
 * Only called with a loaded file holding categories; no room exists at start, so none is in use.
 */
export async function cleanUpPhotos(
  dataDir: string,
  categories: readonly Category[],
  log: (line: string) => void = console.log,
): Promise<number> {
  const keep = new Set<string>();
  for (const c of categories) {
    for (const level of [...Object.values(c.live), ...Object.values(c.draft)]) {
      for (const p of level.places) {
        if (p.photo) keep.add(`${p.photo.id}.webp`).add(`${p.photo.id}-thumb.webp`);
      }
    }
  }
  const dir = join(dataDir, 'photos');
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw err;
  }
  const orphans = names.filter((n) => n.endsWith('.webp') && !keep.has(n));
  if (orphans.length === 0) return 0;
  log(`Photos: deleting ${orphans.length} unreferenced file(s)`);
  await Promise.all(orphans.map((n) => rm(join(dir, n), { force: true })));
  return orphans.length;
}

/**
 * Loads `DATA_DIR/categories.json` (missing means no categories). With no categories outside
 * production it serves the dev fixture ("World (dev)") in memory, never writing it to disk.
 */
export async function loadCategoryStore({
  dataDir,
  production,
  log,
}: {
  dataDir: string;
  production: boolean;
  log?: (line: string) => void;
}): Promise<CategoryStore> {
  const path = join(dataDir, CATEGORIES_FILE);
  const file = await readCategoriesFile(path);
  const categories = file?.categories ?? [];
  // Never on an empty or missing file: a lost categories.json must not take the photos with it.
  if (categories.length > 0) await cleanUpPhotos(dataDir, categories, log);
  if (categories.length === 0 && !production) {
    const fixture = (await readCategoriesFile(DEV_FIXTURE))?.categories ?? [];
    return new CategoryStore(fixture, { file: path, unsavedIds: fixture.map((c) => c.id) });
  }
  return new CategoryStore(categories, { file: path });
}
