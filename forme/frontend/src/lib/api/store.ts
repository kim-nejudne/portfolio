import type { JobRecord, PreflightReport, PriceMatrix } from '@/lib/types';
import { JOB_RECORDS } from './fixtures/jobs';
import { PREFLIGHT_REPORTS } from './fixtures/preflight';
import { PRICE_MATRIX } from './fixtures/pricing';

/**
 * The in-memory store. Fixtures are cloned once on load and never mutated;
 * every write happens against these copies. When the NestJS API lands this
 * module is the only thing that goes.
 */
const jobs: JobRecord[] = structuredClone(JOB_RECORDS) as JobRecord[];
const reports: PreflightReport[] = structuredClone(PREFLIGHT_REPORTS) as PreflightReport[];
let matrix: PriceMatrix = structuredClone(PRICE_MATRIX) as PriceMatrix;
let sequence = 422;

export function readJobs(): readonly JobRecord[] {
  return jobs;
}

export function readJob(reference: string): JobRecord | undefined {
  return jobs.find((job) => job.reference === reference);
}

export function writeJob(reference: string, patch: Partial<JobRecord>): JobRecord | undefined {
  const index = jobs.findIndex((job) => job.reference === reference);
  if (index < 0) return undefined;
  const next = { ...jobs[index], ...patch };
  jobs[index] = next;
  return next;
}

export function insertJob(record: JobRecord): JobRecord {
  jobs.unshift(record);
  return record;
}

export function readReports(): readonly PreflightReport[] {
  return reports;
}

export function writeReport(id: string, next: PreflightReport): void {
  const index = reports.findIndex((report) => report.id === id);
  if (index < 0) reports.push(next);
  else reports[index] = next;
}

export function readMatrix(): PriceMatrix {
  return matrix;
}

export function writeMatrix(next: PriceMatrix): void {
  matrix = next;
}

/** References are FM + year/month + sequence: FM-2608-0417. */
export function nextReference(yearMonth = '2608'): string {
  sequence += 1;
  return `FM-${yearMonth}-${sequence.toString().padStart(4, '0')}`;
}
