import { describe, expect, it } from 'vitest';
import {
  IllegalTransitionError,
  IMMOVABLE_STATES,
  JOB_STATE_SEQUENCE,
  TRANSITIONS,
  assertTransition,
  canTransition,
  progressOf,
} from '../state-machine';
import type { JobState } from '../types';

const ALL_STATES = Object.keys(TRANSITIONS) as JobState[];

describe('the transition table', () => {
  it('covers every job state', () => {
    // A state missing from the table would throw at runtime on the first
    // attempt to move a job into or out of it.
    expect(ALL_STATES).toHaveLength(12);
    for (const state of JOB_STATE_SEQUENCE) {
      expect(TRANSITIONS[state]).toBeDefined();
    }
    expect(TRANSITIONS.HELD).toBeDefined();
    expect(TRANSITIONS.CANCELLED).toBeDefined();
  });

  it('never names a target that is not itself a state', () => {
    for (const [from, targets] of Object.entries(TRANSITIONS)) {
      for (const target of targets) {
        expect(ALL_STATES, `${from} -> ${target}`).toContain(target);
      }
    }
  });

  it('walks the whole production path one step at a time', () => {
    for (let i = 0; i < JOB_STATE_SEQUENCE.length - 1; i += 1) {
      const from = JOB_STATE_SEQUENCE[i]!;
      const to = JOB_STATE_SEQUENCE[i + 1]!;
      expect(canTransition(from, to), `${from} -> ${to} should be legal`).toBe(true);
    }
  });

  it('refuses to skip a step', () => {
    expect(canTransition('ESTIMATE', 'PREFLIGHT')).toBe(false);
    expect(canTransition('PREFLIGHT', 'APPROVED')).toBe(false);
    expect(canTransition('APPROVED', 'ON_PRESS')).toBe(false);
  });

  it('lets a rejected proof go back to preflight, but not further', () => {
    expect(canTransition('PROOFING', 'PREFLIGHT')).toBe(true);
    expect(canTransition('PROOFING', 'ARTWORK_RECEIVED')).toBe(false);
  });

  it('allows a hold from anywhere on the path, and only resumes at preflight', () => {
    for (const state of JOB_STATE_SEQUENCE) {
      const canHold = canTransition(state, 'HELD');
      // Despatched is finished; there is nothing left to hold.
      expect(canHold, `${state} -> HELD`).toBe(state !== 'DESPATCHED');
    }
    // A job that sat still long enough to be held gets re-checked, not resumed
    // wherever it left off.
    expect(TRANSITIONS.HELD).toEqual(['PREFLIGHT', 'CANCELLED']);
  });

  it('treats despatched and cancelled as terminal', () => {
    for (const state of IMMOVABLE_STATES) {
      expect(TRANSITIONS[state]).toEqual([]);
      for (const target of ALL_STATES) {
        expect(canTransition(state, target), `${state} -> ${target}`).toBe(false);
      }
    }
  });
});

describe('assertTransition', () => {
  it('passes silently on a legal move', () => {
    expect(() => assertTransition('PREFLIGHT', 'PROOFING')).not.toThrow();
  });

  it('throws IllegalTransitionError naming what was allowed', () => {
    expect(() => assertTransition('ESTIMATE', 'ON_PRESS')).toThrow(IllegalTransitionError);
    try {
      assertTransition('ESTIMATE', 'ON_PRESS');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('ESTIMATE cannot move to ON_PRESS');
      // The message has to be useful to whoever reads the 409.
      expect(message).toContain('ARTWORK_RECEIVED');
    }
  });

  it('says "terminal" rather than listing an empty set', () => {
    expect(() => assertTransition('DESPATCHED', 'ON_PRESS')).toThrow(
      /DESPATCHED is terminal/,
    );
  });
});

describe('progressOf', () => {
  it('runs from the first step to 100% at despatch', () => {
    expect(progressOf('ESTIMATE')).toBe(10);
    expect(progressOf('DESPATCHED')).toBe(100);
  });

  it('increases monotonically along the path', () => {
    const values = JOB_STATE_SEQUENCE.map(progressOf);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('reports zero for states off the path', () => {
    // The job page substitutes the last state actually reached; that decision
    // belongs to buildJob, not here.
    expect(progressOf('HELD')).toBe(0);
    expect(progressOf('CANCELLED')).toBe(0);
  });
});
