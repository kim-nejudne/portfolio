import { describe, expect, it } from 'vitest';
import type { Effect } from './types.js';

describe('Effect', () => {
  it('lets each fx kind go only to its target (checked by the typechecker)', () => {
    const ok: Effect[] = [
      { type: 'fx', to: { pid: 'p1' }, fx: { kind: 'closeAlert', pid: 'p2' } },
      { type: 'fx', to: 'screen', fx: { kind: 'wrongGuess', pid: 'p2', text: 'payong' } },
      { type: 'fx', to: 'all', fx: { kind: 'correct', pid: 'p2', points: 270, order: 1 } },
    ];
    const misTargeted: Effect[] = [
      // @ts-expect-error a close-guess alert never goes to the Screen
      { type: 'fx', to: 'screen', fx: { kind: 'closeAlert', pid: 'p2' } },
      // @ts-expect-error wrong guesses go to Screens, not to every phone
      { type: 'fx', to: 'all', fx: { kind: 'wrongGuess', pid: 'p2', text: 'payong' } },
      // @ts-expect-error a near miss is for the guesser alone
      { type: 'fx', to: 'all', fx: { kind: 'nearMiss' } },
    ];
    expect(ok).toHaveLength(3);
    expect(misTargeted).toHaveLength(3);
  });
});
