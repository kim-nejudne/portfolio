// The registry reads the tree it was built from under one path shape, `content/…`, whether the
// build took content/ or the e2e build took fixtures/content/ (src/content/node/roots.ts).
import { describe, expect, it } from 'vitest';
import { registryPath, registryPaths } from './glob-keys';

describe('registryPath', () => {
  it('maps a key of either tree to the repository-relative content/ path', () => {
    expect(registryPath('/content/roadmap.yaml', 'content')).toBe(
      'content/roadmap.yaml',
    );
    expect(
      registryPath(
        '/fixtures/content/modules/m99-fixtures/01-fix/lesson.mdx',
        'fixtures/content',
      ),
    ).toBe('content/modules/m99-fixtures/01-fix/lesson.mdx');
  });

  it('refuses a key outside the root, so a wrong root fails the page instead of emptying it', () => {
    expect(() =>
      registryPath('/content/roadmap.yaml', 'fixtures/content'),
    ).toThrow('/content/roadmap.yaml is not under /fixtures/content/');
  });

  it('maps every key of a glob result', () => {
    expect(
      registryPaths(
        { '/fixtures/content/a.yaml': 1, '/fixtures/content/b/c.ts': 2 },
        'fixtures/content',
      ),
    ).toEqual({ 'content/a.yaml': 1, 'content/b/c.ts': 2 });
  });
});
