import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  type Customer,
  type JobComment,
  type JobFile,
  type JobRecord,
  type JobState,
  type PreflightReport,
  type Role,
} from '@forme/domain';
import { DATABASE, type Database } from '../db/database.module';
import {
  customers,
  jobComments,
  jobEvents,
  jobFiles,
  jobs,
  preflightChecks,
  preflightReports,
  type JobRow,
} from '../db/schema';

export interface JobBundle {
  record: JobRecord;
  customer: Customer;
  report: PreflightReport | null;
}

/**
 * Reads jobs out of Postgres and back into the domain's `JobRecord` shape.
 *
 * The one thing worth knowing: `stamps` is **derived from `job_events`**, not
 * stored on the job. The job row holds only its current state; the history is
 * the event table. That means a timeline can never disagree with the audit
 * trail, because there is only one record of what happened.
 */
@Injectable()
export class JobsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findBundles(filter: {
    customerId?: string;
    states?: readonly JobState[];
    references?: readonly string[];
  }): Promise<JobBundle[]> {
    const conditions = [];
    if (filter.customerId) conditions.push(eq(jobs.customerId, filter.customerId));
    if (filter.states?.length) conditions.push(inArray(jobs.state, [...filter.states]));
    if (filter.references?.length) conditions.push(inArray(jobs.reference, [...filter.references]));

    const rows = await this.db
      .select({ job: jobs, customer: customers })
      .from(jobs)
      .innerJoin(customers, eq(customers.id, jobs.customerId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(jobs.dueAt));

    if (rows.length === 0) return [];

    const references = rows.map((row) => row.job.reference);
    const [stamps, comments, files, reports] = await Promise.all([
      this.stampsFor(references),
      this.commentsFor(references),
      this.filesFor(references),
      this.reportsFor(references),
    ]);

    return rows.map(({ job, customer }) => ({
      record: toRecord(job, {
        stamps: stamps.get(job.reference) ?? {},
        comments: comments.get(job.reference) ?? [],
        files: files.get(job.reference) ?? [],
      }),
      customer: toCustomer(customer),
      report: job.preflightReportId ? (reports.get(job.preflightReportId) ?? null) : null,
    }));
  }

  async findBundle(reference: string): Promise<JobBundle | null> {
    const [bundle] = await this.findBundles({ references: [reference] });
    return bundle ?? null;
  }

  /**
   * The first time each state was entered, per job. `DISTINCT ON` keeps the
   * earliest row so a job that bounced PROOFING → PREFLIGHT → PROOFING shows
   * when it first got there, which is what the timeline means.
   */
  private async stampsFor(
    references: string[],
  ): Promise<Map<string, Partial<Record<JobState, string>>>> {
    const rows = await this.db
      .selectDistinctOn([jobEvents.jobReference, jobEvents.toState], {
        jobReference: jobEvents.jobReference,
        state: jobEvents.toState,
        at: jobEvents.at,
      })
      .from(jobEvents)
      .where(inArray(jobEvents.jobReference, references))
      .orderBy(asc(jobEvents.jobReference), asc(jobEvents.toState), asc(jobEvents.at));

    const map = new Map<string, Partial<Record<JobState, string>>>();
    for (const row of rows) {
      const entry = map.get(row.jobReference) ?? {};
      entry[row.state] = row.at.toISOString();
      map.set(row.jobReference, entry);
    }
    return map;
  }

  private async commentsFor(references: string[]): Promise<Map<string, JobComment[]>> {
    const rows = await this.db
      .select()
      .from(jobComments)
      .where(inArray(jobComments.jobReference, references))
      .orderBy(asc(jobComments.at));

    const map = new Map<string, JobComment[]>();
    for (const row of rows) {
      const list = map.get(row.jobReference) ?? [];
      list.push({
        id: row.id,
        author: row.author,
        role: row.role as Role,
        at: row.at.toISOString(),
        body: row.body,
      });
      map.set(row.jobReference, list);
    }
    return map;
  }

  private async filesFor(references: string[]): Promise<Map<string, JobFile[]>> {
    const rows = await this.db
      .select()
      .from(jobFiles)
      .where(inArray(jobFiles.jobReference, references))
      .orderBy(desc(jobFiles.at));

    const map = new Map<string, JobFile[]>();
    for (const row of rows) {
      const list = map.get(row.jobReference) ?? [];
      list.push({ name: row.name, kind: row.kind, bytes: row.bytes, at: row.at.toISOString() });
      map.set(row.jobReference, list);
    }
    return map;
  }

  private async reportsFor(reportIds: string[]): Promise<Map<string, PreflightReport>> {
    const reports = await this.db
      .select()
      .from(preflightReports)
      .where(inArray(preflightReports.jobReference, reportIds));
    if (reports.length === 0) return new Map();

    const checks = await this.db
      .select()
      .from(preflightChecks)
      .where(
        inArray(
          preflightChecks.reportId,
          reports.map((report) => report.id),
        ),
      )
      .orderBy(asc(preflightChecks.sortOrder));

    const byReport = new Map<string, PreflightReport>();
    for (const report of reports) {
      byReport.set(report.id, {
        id: report.id,
        jobReference: report.jobReference,
        fileName: report.fileName,
        pages: report.pages,
        ranAt: (report.ranAt ?? report.startedAt).toISOString(),
        checks: checks
          .filter((check) => check.reportId === report.id)
          .map((check) => ({
            id: check.checkId,
            label: check.label,
            severity: check.severity,
            measured: check.measured,
            tolerance: check.tolerance,
            finding: check.finding,
            page: check.page,
            waiver: check.waiver,
          })),
      });
    }
    return byReport;
  }

  /**
   * Allocates the next job reference: FM-YYMM-NNNN, with NNNN continuing across
   * months rather than resetting, so a reference is unique on its own.
   *
   * Runs inside the caller's transaction and takes an advisory lock, because two
   * simultaneous submissions both reading `max(...)` would otherwise mint the
   * same reference and one insert would lose.
   */
  async nextReference(tx: Database, now: Date): Promise<string> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('forme_job_reference'))`);
    const [row] = await tx
      .select({ max: sql<string | null>`max(substring(${jobs.reference} from 9))` })
      .from(jobs);
    const next = Number(row?.max ?? '0') + 1;
    const yy = now.getUTCFullYear().toString().slice(-2);
    const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    return `FM-${yy}${mm}-${next.toString().padStart(4, '0')}`;
  }
}

function toRecord(
  row: JobRow,
  extras: {
    stamps: Partial<Record<JobState, string>>;
    comments: JobComment[];
    files: JobFile[];
  },
): JobRecord {
  return {
    reference: row.reference,
    customerId: row.customerId,
    description: row.description,
    spec: row.spec,
    state: row.state,
    stamps: extras.stamps,
    receivedAt: row.receivedAt.toISOString(),
    dueAt: row.dueAt.toISOString(),
    proofState: row.proofState,
    proofAt: row.proofAt?.toISOString() ?? null,
    preflightReportId: row.preflightReportId,
    comments: extras.comments,
    files: extras.files,
    note: row.note,
  };
}

function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    contact: row.contact,
    city: row.city,
    terms: row.terms,
    account: row.account,
  };
}
