import { describe, expect, it } from 'vitest';
import { BUZZER_LOOK } from './buzzerLook.js';
import type { BuzzerKind } from './buzzerState.js';

const KINDS: BuzzerKind[] = [
  'idle',
  'choice',
  'typed',
  'practice',
  'early',
  'live',
  'pressed',
  'won',
  'lost',
  'out',
  'revealed',
  'final',
];

describe('BUZZER_LOOK', () => {
  it('has an entry for every kind, and no others', () => {
    expect(Object.keys(BUZZER_LOOK).sort()).toEqual([...KINDS].sort());
  });

  // docs/ux/09 § The buzzer, row by row.
  it.each([
    ['practice', 'up', 'off', 'red', 'none'],
    ['idle', 'down', 'off', 'drained', 'none'],
    ['live', 'up', 'breathe', 'red', 'none'],
    ['pressed', 'down', 'on', 'red', 'none'],
    ['won', 'down', 'on', 'red', 'none'],
    ['early', 'down', 'off', 'red', 'warn'],
    ['lost', 'up', 'off', 'dim', 'none'],
    ['out', 'down', 'off', 'drained', 'x'],
    // "As now": the drained buzzer stays under the answer card (DECISIONS F145).
    ['revealed', 'down', 'off', 'drained', 'none'],
  ] as const)('%s: cap %s, bulb %s, %s, mark %s', (kind, cap, bulb, tone, mark) => {
    expect(BUZZER_LOOK[kind]).toEqual({ cap, bulb, tone, mark });
  });

  it('draws no buzzer where the choices, the text box or the final result replace it', () => {
    expect(BUZZER_LOOK.choice).toBeNull();
    expect(BUZZER_LOOK.typed).toBeNull();
    expect(BUZZER_LOOK.final).toBeNull();
  });

  it('only the open buzzer breathes, and only a pressed or winning one is lit', () => {
    const with_ = (bulb: string) => KINDS.filter((kind) => BUZZER_LOOK[kind]?.bulb === bulb).sort();
    expect(with_('breathe')).toEqual(['live']);
    expect(with_('on')).toEqual(['pressed', 'won']);
  });
});
