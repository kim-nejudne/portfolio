import { describe, expect, it } from 'vitest';
import { INK_GRID } from '../../../shared/constants.js';
import { DOODLE, DOODLE_MAX_STEP, doodleSteps, type DoodleStep } from './doodle.js';

describe('doodleSteps', () => {
  const steps = doodleSteps();

  it('draws every line of the doodle as begin, moves, end', () => {
    const begins = steps.filter((s) => s.kind === 'begin').length;
    const ends = steps.filter((s) => s.kind === 'end').length;
    expect(begins).toBe(DOODLE.length);
    expect(ends).toBe(DOODLE.length);
    let open = false;
    for (const step of steps) {
      if (step.kind === 'begin') expect(open).toBe(false);
      else expect(open).toBe(true);
      open = step.kind !== 'end';
    }
    expect(open).toBe(false);
  });

  it('keeps every point an integer on the ink grid', () => {
    for (const step of steps) {
      if (step.kind === 'end') continue;
      for (const v of [step.x, step.y]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(INK_GRID);
      }
    }
  });

  it('moves in small steps, so the Screen sees the line grow', () => {
    let last: Extract<DoodleStep, { x: number }> | null = null;
    for (const step of steps) {
      if (step.kind === 'end') {
        last = null;
        continue;
      }
      if (last) {
        expect(Math.hypot(step.x - last.x, step.y - last.y)).toBeLessThanOrEqual(DOODLE_MAX_STEP);
      }
      last = step;
    }
  });

  it('subdivides a long segment and keeps both of its ends', () => {
    expect(
      doodleSteps(
        [
          [
            [0, 0],
            [100, 0],
          ],
        ],
        30,
      ),
    ).toEqual([
      { kind: 'begin', x: 0, y: 0 },
      { kind: 'move', x: 25, y: 0 },
      { kind: 'move', x: 50, y: 0 },
      { kind: 'move', x: 75, y: 0 },
      { kind: 'move', x: 100, y: 0 },
      { kind: 'end' },
    ]);
  });

  it('is short enough to finish well inside a turn', () => {
    expect(steps.length).toBeLessThan(400);
  });
});
