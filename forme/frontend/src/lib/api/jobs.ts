import { JOB_STATE_SEQUENCE, progressOf, stateOwner } from '@/lib/domain';
import type {
  Job,
  JobComment,
  JobFilter,
  JobRecord,
  JobStage,
  JobState,
  QuoteInput,
  Role,
} from '@/lib/types';
import { getNow } from './clock';
import { customerById } from './customers';
import { apiDelay } from './delay';
import { hasBlockingFailure, reportById } from './preflight';
import { quoteFor } from './quotes';
import { insertJob, nextReference, readJob, readJobs, writeJob } from './store';

const PREPRESS_STATES: readonly JobState[] = ['ARTWORK_RECEIVED', 'PREFLIGHT', 'PROOFING'];

function buildStages(record: JobRecord): readonly JobStage[] {
  const terminal = record.state === 'HELD' || record.state === 'CANCELLED';
  const reached = JOB_STATE_SEQUENCE.filter((state) => record.stamps[state] !== undefined);
  const last = reached[reached.length - 1];

  const stages: JobStage[] = JOB_STATE_SEQUENCE.map((state) => {
    const at = record.stamps[state] ?? null;
    const current = !terminal && state === record.state;
    return {
      state,
      at,
      by: null,
      done: at !== null && !current,
      current,
    };
  });

  if (terminal) {
    stages.push({
      state: record.state,
      at: record.stamps[record.state] ?? null,
      by: null,
      done: false,
      current: true,
    });
    return stages.map((stage) =>
      stage.state === last && stage.at !== null ? { ...stage, done: true } : stage,
    );
  }
  return stages;
}

function lastReachedState(record: JobRecord): JobState {
  const reached = JOB_STATE_SEQUENCE.filter((state) => record.stamps[state] !== undefined);
  return reached[reached.length - 1] ?? 'ESTIMATE';
}

export function buildJob(record: JobRecord): Job {
  const report = reportById(record.preflightReportId);
  const blocked = hasBlockingFailure(report);
  const from = record.proofAt ?? record.receivedAt;
  return {
    ...record,
    customer: customerById(record.customerId),
    quote: quoteFor(record.spec, from),
    stages: buildStages(record),
    progress:
      record.state === 'HELD' || record.state === 'CANCELLED'
        ? progressOf(lastReachedState(record))
        : progressOf(record.state),
    owner: stateOwner(record.state, blocked),
  };
}

export async function getJobs(filter: JobFilter = {}): Promise<readonly Job[]> {
  await apiDelay(160);
  return readJobs()
    .filter((record) => (filter.customerId ? record.customerId === filter.customerId : true))
    .filter((record) => (filter.states ? filter.states.includes(record.state) : true))
    .map(buildJob);
}

export async function getJob(reference: string): Promise<Job | null> {
  await apiDelay(140);
  const record = readJob(reference);
  return record ? buildJob(record) : null;
}

export async function getPrepressQueue(): Promise<readonly Job[]> {
  await apiDelay(170);
  return readJobs()
    .filter((record) => PREPRESS_STATES.includes(record.state))
    .map(buildJob)
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export async function approveProof(reference: string, by: string): Promise<void> {
  await apiDelay(180);
  const record = readJob(reference);
  if (!record) return;
  const at = getNow();
  writeJob(reference, {
    state: 'APPROVED',
    proofState: 'APPROVED',
    stamps: { ...record.stamps, APPROVED: at },
    comments: [
      ...record.comments,
      {
        id: `c-${reference}-${record.comments.length + 1}`,
        author: by,
        role: 'customer',
        at,
        body: 'Proof approved. Artwork locked for press.',
      },
    ],
  });
}

export async function rejectProof(reference: string, reason: string, by: string): Promise<void> {
  await apiDelay(180);
  const record = readJob(reference);
  if (!record) return;
  const at = getNow();
  writeJob(reference, {
    state: 'PREFLIGHT',
    proofState: 'REJECTED',
    stamps: { ...record.stamps, PREFLIGHT: at },
    comments: [
      ...record.comments,
      {
        id: `c-${reference}-${record.comments.length + 1}`,
        author: by,
        role: 'customer',
        at,
        body: `Proof rejected. ${reason}`,
      },
    ],
  });
}

export async function addComment(
  reference: string,
  body: string,
  author: string,
  role: Role,
): Promise<void> {
  await apiDelay(120);
  const record = readJob(reference);
  if (!record) return;
  const comment: JobComment = {
    id: `c-${reference}-${record.comments.length + 1}`,
    author,
    role,
    at: getNow(),
    body,
  };
  writeJob(reference, { comments: [...record.comments, comment] });
}

export interface NewJobInput {
  customerId: string;
  description: string;
  spec: QuoteInput;
  fileName: string | null;
  fileBytes: number;
}

export async function createJob(input: NewJobInput): Promise<Job> {
  await apiDelay(200);
  const at = getNow();
  const reference = nextReference();
  const quote = quoteFor(input.spec, at);
  const record: JobRecord = {
    reference,
    customerId: input.customerId,
    description: input.description,
    spec: input.spec,
    state: input.fileName ? 'PREFLIGHT' : 'ESTIMATE',
    stamps: input.fileName
      ? { ESTIMATE: at, ARTWORK_RECEIVED: at, PREFLIGHT: at }
      : { ESTIMATE: at },
    receivedAt: at,
    dueAt: quote.despatchAt,
    proofState: 'NONE',
    proofAt: null,
    preflightReportId: input.fileName ? 'PF-INTAKE' : null,
    comments: [],
    files: input.fileName
      ? [{ name: input.fileName, kind: 'PDF', bytes: input.fileBytes, at }]
      : [],
    note: null,
  };
  insertJob(record);
  return buildJob(record);
}

export async function holdJob(reference: string, reason: string): Promise<void> {
  await apiDelay(150);
  const record = readJob(reference);
  if (!record) return;
  writeJob(reference, {
    state: 'HELD',
    stamps: { ...record.stamps, HELD: getNow() },
    note: reason,
  });
}
