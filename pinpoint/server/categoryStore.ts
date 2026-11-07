import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { categoriesFileSchema } from '#shared/schemas.js';
import type {
  CategoriesFile,
  Category,
  CategoryLevelCounts,
  CategorySummary,
  Difficulty,
} from '#shared/types.js';

/** Read at runtime (not imported), so the fixture never lands in the production bundle. */
const DEV_FIXTURE = new URL('./fixtures/dev-world.json', import.meta.url);

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
    counts[level] = {
      city: content.places.filter((p) => p.kind === 'city').length,
      landmark: content.places.filter((p) => p.kind === 'landmark').length,
    };
  }
  return { id: c.id, name: c.name, emoji: c.emoji, box: c.box, labelStyle: c.labelStyle, counts };
}

/** The stored categories (spec: Stored categories). Read-only for now; the admin adds writes. */
export class CategoryStore {
  constructor(private readonly categories: Category[]) {}

  /** Live, visible categories for `GET /api/categories`: never places, never drafts. */
  summaries(): CategorySummary[] {
    return this.categories.filter(isLiveVisible).map(summarise);
  }

  /** A live, visible category with its places, or undefined. */
  get(id: string): Category | undefined {
    return this.categories.find((c) => c.id === id && isLiveVisible(c));
  }
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
 * Loads `DATA_DIR/categories.json` (missing means no categories). With no categories outside
 * production it serves the dev fixture ("World (dev)") in memory, never writing it to disk.
 */
export async function loadCategoryStore({
  dataDir,
  production,
}: {
  dataDir: string;
  production: boolean;
}): Promise<CategoryStore> {
  const file = await readCategoriesFile(join(dataDir, 'categories.json'));
  const categories = file?.categories ?? [];
  if (categories.length === 0 && !production) {
    return new CategoryStore((await readCategoriesFile(DEV_FIXTURE))?.categories ?? []);
  }
  return new CategoryStore(categories);
}
