import { describe, expect, it } from 'vitest';
import { buildJob, buildStages, lastReachedState } from '../job';
import { countBySeverity, hasBlockingFailure, skippedChecks } from '../preflight';
import { stateOwner } from '../vocabulary';
import type { PreflightCheck, PreflightReport } from '../types';
import { TEST_CUSTOMER, TEST_MATRIX, jobRecord } from './fixtures';

const context = { customer: TEST_CUSTOMER, matrix: TEST_MATRIX, blocked: false };

function check(overrides: Partial<PreflightCheck> = {}): PreflightCheck {
  return {
    id: 'bleed',
    label: 'Bleed present on all edges',
    severity: 'PASS',
    measured: '3mm',
    tolerance: '3mm all round',
    finding: 'Bleed 3mm all round.',
    page: 'p1',
    waiver: null,
    ...overrides,
  };
}

function report(checks: PreflightCheck[]): PreflightReport {
  return {
    id: 'PF-TEST',
    jobReference: 'FM-2608-0001',
    fileName: 'artwork.pdf',
    pages: 1,
    ranAt: '2026-08-01T11:00:00+08:00',
    checks,
  };
}

describe('buildStages', () => {
  it('stamps the states a job has reached and marks the current one', () => {
    const stages = buildStages(jobRecord());
    const stamped = stages.filter((stage) => stage.at !== null);
    expect(stamped.map((stage) => stage.state)).toEqual([
      'ESTIMATE',
      'ARTWORK_RECEIVED',
      'PREFLIGHT',
    ]);
    const current = stages.filter((stage) => stage.current);
    expect(current).toHaveLength(1);
    expect(current[0]!.state).toBe('PREFLIGHT');
  });

  it('does not mark the current state as done — it is still happening', () => {
    const stages = buildStages(jobRecord());
    const preflight = stages.find((stage) => stage.state === 'PREFLIGHT')!;
    expect(preflight.current).toBe(true);
    expect(preflight.done).toBe(false);

    const received = stages.find((stage) => stage.state === 'ARTWORK_RECEIVED')!;
    expect(received.done).toBe(true);
  });

  it('appends the stopping point for a held job, keeping its history', () => {
    const stages = buildStages(
      jobRecord({
        state: 'HELD',
        stamps: {
          ESTIMATE: '2026-08-01T09:00:00+08:00',
          ARTWORK_RECEIVED: '2026-08-01T10:00:00+08:00',
          PREFLIGHT: '2026-08-01T11:00:00+08:00',
          HELD: '2026-08-02T09:00:00+08:00',
        },
      }),
    );
    const held = stages.filter((stage) => stage.state === 'HELD');
    expect(held).toHaveLength(1);
    expect(held[0]!.current).toBe(true);
    // The path it walked before the hold is still shown as done.
    expect(stages.find((stage) => stage.state === 'PREFLIGHT')!.done).toBe(true);
  });
});

describe('lastReachedState', () => {
  it('is the furthest production state stamped', () => {
    expect(lastReachedState(jobRecord())).toBe('PREFLIGHT');
  });

  it('falls back to ESTIMATE for a job with no stamps at all', () => {
    expect(lastReachedState(jobRecord({ stamps: {} }))).toBe('ESTIMATE');
  });
});

describe('buildJob', () => {
  it('composes the customer, the quote and the derived fields', () => {
    const job = buildJob(jobRecord(), context);
    expect(job.customer.shortName).toBe('Nine Dots');
    expect(job.quote.total).toBeGreaterThan(0);
    expect(job.progress).toBe(30);
    expect(job.owner).toBe('system');
  });

  it('reports a blocked preflight as waiting on a person, not the system', () => {
    // This is what turns the job cyan rather than magenta on the board, so it
    // is the difference between "we are working on it" and "you must act".
    const job = buildJob(jobRecord(), { ...context, blocked: true });
    expect(job.owner).toBe('human');
  });

  it('shows a cancelled job at the progress it actually reached', () => {
    const cancelled = buildJob(
      jobRecord({
        state: 'CANCELLED',
        stamps: {
          ESTIMATE: '2026-08-01T09:00:00+08:00',
          ARTWORK_RECEIVED: '2026-08-01T10:00:00+08:00',
          PREFLIGHT: '2026-08-01T11:00:00+08:00',
          PROOFING: '2026-08-01T12:00:00+08:00',
          APPROVED: '2026-08-01T13:00:00+08:00',
          IMPOSED: '2026-08-01T14:00:00+08:00',
          CANCELLED: '2026-08-02T09:00:00+08:00',
        },
      }),
      context,
    );
    // A job cancelled at IMPOSED is further along than one cancelled at
    // ESTIMATE, and the board should not flatten both to zero.
    expect(cancelled.progress).toBe(60);
    expect(cancelled.owner).toBe('final');
  });

  it('prices from proof approval where there is one', () => {
    const withoutProof = buildJob(jobRecord(), context);
    const withProof = buildJob(
      jobRecord({ proofAt: '2026-08-20T09:00:00+08:00' }),
      context,
    );
    // The turnaround clock starts at approval, so the despatch date moves.
    expect(withProof.quote.despatchAt).not.toBe(withoutProof.quote.despatchAt);
    expect(Date.parse(withProof.quote.despatchAt)).toBeGreaterThan(
      Date.parse(withoutProof.quote.despatchAt),
    );
  });
});

describe('stateOwner', () => {
  it('assigns each state to whoever the job is waiting on', () => {
    expect(stateOwner('PREFLIGHT')).toBe('system');
    expect(stateOwner('IMPOSED')).toBe('system');
    expect(stateOwner('PROOFING')).toBe('human');
    expect(stateOwner('ESTIMATE')).toBe('human');
    expect(stateOwner('HELD')).toBe('held');
    expect(stateOwner('DESPATCHED')).toBe('final');
    expect(stateOwner('CANCELLED')).toBe('final');
  });

  it('moves a blocked preflight from the system to a person', () => {
    expect(stateOwner('PREFLIGHT', false)).toBe('system');
    expect(stateOwner('PREFLIGHT', true)).toBe('human');
  });
});

describe('preflight predicates', () => {
  it('counts a waived check as a pass, because operationally it is one', () => {
    const counts = countBySeverity(
      report([
        check({ id: 'bleed', severity: 'FAIL' }),
        check({
          id: 'trim-size',
          severity: 'FAIL',
          waiver: {
            reason: 'Trimming in house, agreed by phone.',
            by: 'R. Salcedo',
            at: '2026-08-02T09:00:00+08:00',
            kind: 'OVERRIDDEN',
          },
        }),
      ]),
    );
    expect(counts.FAIL).toBe(1);
    expect(counts.PASS).toBe(1);
  });

  it('counts SKIPPED separately — it is not a pass', () => {
    const counts = countBySeverity(report([check({ severity: 'SKIPPED' })]));
    expect(counts.SKIPPED).toBe(1);
    expect(counts.PASS).toBe(0);
  });

  it('blocks on an unwaived failure only', () => {
    expect(hasBlockingFailure(report([check({ severity: 'FAIL' })]))).toBe(true);
    expect(
      hasBlockingFailure(
        report([
          check({
            severity: 'FAIL',
            waiver: {
              reason: 'Accepted with a written reason.',
              by: 'R. Salcedo',
              at: '2026-08-02T09:00:00+08:00',
              kind: 'OVERRIDDEN',
            },
          }),
        ]),
      ),
    ).toBe(false);
    expect(hasBlockingFailure(report([check({ severity: 'WARN' })]))).toBe(false);
    // A check that never ran cannot block; it also cannot clear.
    expect(hasBlockingFailure(report([check({ severity: 'SKIPPED' })]))).toBe(false);
  });

  it('treats a missing report as not blocking', () => {
    expect(hasBlockingFailure(null)).toBe(false);
    expect(countBySeverity(null)).toEqual({ PASS: 0, WARN: 0, FAIL: 0, SKIPPED: 0 });
  });

  it('lists which checks did not run, so the UI can say so', () => {
    const skipped = skippedChecks(
      report([check({ id: 'hairlines', severity: 'SKIPPED' }), check({ id: 'bleed' })]),
    );
    expect(skipped).toEqual(['hairlines']);
  });
});
