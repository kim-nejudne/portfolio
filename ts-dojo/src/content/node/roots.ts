// The two content trees (spec §3 Layout). `content/` is the course the app ships; the build,
// `pnpm preview`, the content lint and deploy.sh read it. `fixtures/content/` is the fixture
// course the tests run against (F6–F10's pipeline, verification, roadmap and settings fixtures):
// `vite build --mode e2e` builds it into `dist-e2e/` for the Playwright suite, and the unit
// tests read it from disk. Each tree has its own roadmap.yaml and renames.yaml.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** The Vite mode that builds the fixture course. */
export const E2E_MODE = 'e2e';

/** Content directories, relative to the repository root. */
export const COURSE_DIR = 'content';
export const FIXTURE_DIR = 'fixtures/content';

/** Absolute paths of the two trees. */
export const COURSE_CONTENT = path.join(REPO_ROOT, COURSE_DIR);
export const FIXTURE_CONTENT = path.join(REPO_ROOT, FIXTURE_DIR);

/** The content directory a Vite mode builds. */
export function contentDirFor(mode: string): string {
  return mode === E2E_MODE ? FIXTURE_DIR : COURSE_DIR;
}

/** The build output directory of a Vite mode; the fixture build never overwrites `dist/`. */
export function outDirFor(mode: string): string {
  return mode === E2E_MODE ? 'dist-e2e' : 'dist';
}
