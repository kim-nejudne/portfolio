import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '../safe-redirect';

const HOME = '/prepress';

describe('safeRedirectPath', () => {
  it('allows a same-site absolute path', () => {
    expect(safeRedirectPath('/app/jobs/FM-2608-0417', HOME)).toBe('/app/jobs/FM-2608-0417');
    expect(safeRedirectPath('/admin/pricing?sort=label', HOME)).toBe('/admin/pricing?sort=label');
  });

  it('falls back when there is nothing to return to', () => {
    expect(safeRedirectPath(undefined, HOME)).toBe(HOME);
    expect(safeRedirectPath('', HOME)).toBe(HOME);
    expect(safeRedirectPath(null, HOME)).toBe(HOME);
    expect(safeRedirectPath(42, HOME)).toBe(HOME);
  });

  /**
   * The whole reason this function exists. Each of these would send someone to
   * another origin immediately after they signed in — the moment they are most
   * likely to trust what is on screen.
   */
  it.each([
    'https://evil.test/harvest',
    'http://evil.test',
    '//evil.test',
    '//evil.test/app',
    '/\\evil.test',
    '/\\/evil.test',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '/app\\@evil.test',
    '/\thttps://evil.test',
    '/\nhttps://evil.test',
    '/app\r\nSet-Cookie: forme_access=forged',
    'evil.test',
    '../../etc/passwd',
  ])('refuses %j', (attempt) => {
    expect(safeRedirectPath(attempt, HOME)).toBe(HOME);
  });

  it('never returns anything that is not an absolute path', () => {
    const attempts = ['/ok', '//evil', 'https://evil', '', '/a\\b', '/c\td'];
    for (const attempt of attempts) {
      const result = safeRedirectPath(attempt, HOME);
      expect(result.startsWith('/')).toBe(true);
      expect(result.startsWith('//')).toBe(false);
    }
  });
});
