// The chip's text for every client status (§4: "compiler loading" until ready; §9: the restart
// notice). The chip itself is exercised by e2e/compiler.spec.ts in Chrome.
import { describe, expect, it } from 'vitest';
import { compilerStatusText, RESTART_NOTICE_MS } from './compiler-status';

describe('compilerStatusText', () => {
  it('reads "compiler loading" until ready, then the TypeScript version', () => {
    expect(compilerStatusText({ state: 'loading', restarts: 0 }, false)).toBe(
      'compiler loading',
    );
    expect(
      compilerStatusText(
        { state: 'ready', tsVersion: '6.0.3', restarts: 0 },
        false,
      ),
    ).toBe('TypeScript 6.0.3');
  });

  it('shows the restart notice for 5 s after a restart, and the failure', () => {
    expect(
      compilerStatusText({ state: 'restarting', restarts: 1 }, false),
    ).toBe('compiler restarting');
    expect(
      compilerStatusText(
        { state: 'ready', tsVersion: '6.0.3', restarts: 1 },
        true,
      ),
    ).toBe('compiler restarted');
    expect(RESTART_NOTICE_MS).toBe(5000);
    expect(
      compilerStatusText(
        { state: 'failed', restarts: 4, message: 'boom' },
        false,
      ),
    ).toBe('compiler failed');
  });
});
