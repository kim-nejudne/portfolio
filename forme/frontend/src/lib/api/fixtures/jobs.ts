import type { JobRecord } from '@/lib/types';
import { JOBS_OPEN } from './jobs-open';
import { JOBS_PRESS } from './jobs-press';

export const JOB_RECORDS: readonly JobRecord[] = [...JOBS_OPEN, ...JOBS_PRESS];
