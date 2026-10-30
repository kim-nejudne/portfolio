import { describe, expect, it } from 'vitest';
import type { Action, Effect } from './types.js';

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

describe('Action', () => {
  it('builds actions without a payload (checked by the typechecker)', () => {
    const by = { kind: 'screen', isHost: true } as const;
    const actions: Action[] = [
      { type: 'host:start', by },
      { type: 'player:leave', by: { kind: 'player', pid: 'p1', isHost: false } },
    ];
    expect(actions).toHaveLength(2);
  });
});
