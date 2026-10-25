// The course build (dist/, `pnpm build`) for a test outside e2e/course.spec.ts, served the way
// that spec serves it: one private `startDistServer` per worker with the §10 CSP on, never the
// suite's server on 4173 (which serves the fixture course), and refused when dist/ was not built
// from content/ as it stands (its inlined §7 `contentVersion`). `courseTest` is Playwright's
// `test` with `baseURL` pointing at that server.
import { test as base } from '@playwright/test';
import { COURSE_CONTENT, courseAt } from './course';
import {
  builtFrom,
  DIST,
  startDistServer,
  type DistServer,
} from './preview-server';

export const courseTest = base.extend<object, { courseServer: DistServer }>({
  courseServer: [
    // Playwright reads the fixtures a fixture needs from its first parameter's pattern.
    // eslint-disable-next-line no-empty-pattern
    async ({}, provide) => {
      const version = await courseAt(COURSE_CONTENT).contentHash();
      if (!(await builtFrom(DIST, version))) {
        throw new Error(
          `${DIST} is not a build of ${COURSE_CONTENT} as it stands (contentVersion ${version}): run \`pnpm build\` first`,
        );
      }
      const server = await startDistServer({ dir: DIST });
      await provide(server);
      await server.close();
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ courseServer }, provide) => {
    await provide(courseServer.url);
  },
});
