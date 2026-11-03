import { describe, expect, it } from 'vitest';
import type { GenerationHistoryEntry } from '../../../shared/types.js';
import {
  kindText,
  levelsText,
  outcomeText,
  savedText,
  shownText,
  whenText,
} from './adminHistory.js';

const entry = (overrides: Partial<GenerationHistoryEntry> = {}): GenerationHistoryEntry => ({
  endedAt: 0,
  startedAt: 0,
  kind: 'generate',
  category: 'Rivers',
  levels: [
    { difficulty: 'easy', count: 15 },
    { difficulty: 'hard', count: 12 },
  ],
  saved: 25,
  costUsd: 0,
  outcome: 'done',
  ...overrides,
});

describe('adminHistory text (F128)', () => {
  it('names each kind, a replace covering additions too', () => {
    expect([kindText('generate'), kindText('regenerate'), kindText('replace')]).toEqual([
      'Generate',
      'Regenerate',
      'Replace or add',
    ]);
  });

  it('names each outcome', () => {
    expect([outcomeText('done'), outcomeText('failed'), outcomeText('cancelled')]).toEqual([
      'Done',
      'Failed',
      'Cancelled',
    ]);
  });

  it('writes the levels asked for, in order', () => {
    expect(levelsText(entry().levels)).toBe('Easy 15 · Hard 12');
    expect(levelsText([{ difficulty: 'medium', count: 1 }])).toBe('Medium 1');
  });

  it('writes the questions saved of those asked for', () => {
    expect(savedText(entry())).toBe('25 of 27');
    expect(savedText(entry({ levels: [{ difficulty: 'easy', count: 1 }], saved: 0 }))).toBe(
      '0 of 1',
    );
  });

  it('writes when a job ended with its date and time', () => {
    const at = new Date(2026, 10, 3, 13, 28).getTime();
    expect(whenText(at)).toMatch(/2026/);
    expect(whenText(at)).toMatch(/(13:28|1:28\sPM)/);
  });

  it('says how many it shows only when the log holds more', () => {
    expect(shownText(50, 73)).toBe('The newest 50 of 73 jobs.');
    expect(shownText(3, 3)).toBeNull();
  });
});
