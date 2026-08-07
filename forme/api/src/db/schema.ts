/**
 * The FORME schema.
 *
 * Two decisions worth stating up front, because they shape everything else:
 *
 * 1. **Money is `integer`, never `numeric` or `real`.** Every amount is a whole
 *    peso and every multiplier is integer per-mille. A float column would let a
 *    rounding error into a price the moment anyone aggregated one.
 *
 * 2. **Job state is never updated in isolation.** Every move writes a row to
 *    `job_events` in the same transaction, so the timeline is derived from
 *    history rather than reconstructed from guesswork. The `stamps` the UI
 *    renders are a projection of that table, not a second source of truth.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type {
  ImpositionPlan,
  JobState,
  PreflightCheckId,
  PreflightWaiver,
  QuoteInput,
  Role,
} from '@forme/domain';

/* ------------------------------------------------------------------ enums */

export const roleEnum = pgEnum('role', ['customer', 'prepress', 'floor', 'admin']);

export const jobStateEnum = pgEnum('job_state', [
  'ESTIMATE',
  'ARTWORK_RECEIVED',
  'PREFLIGHT',
  'PROOFING',
  'APPROVED',
  'IMPOSED',
  'PLATED',
  'ON_PRESS',
  'FINISHING',
  'DESPATCHED',
  'HELD',
  'CANCELLED',
]);

export const proofStateEnum = pgEnum('proof_state', [
  'NONE',
  'AWAITING_APPROVAL',
  'APPROVED',
  'REJECTED',
]);

export const severityEnum = pgEnum('check_severity', ['PASS', 'WARN', 'FAIL', 'SKIPPED']);

export const pressStateEnum = pgEnum('press_state', ['MAKEREADY', 'RUNNING', 'WASHUP', 'IDLE']);

export const waiverKindEnum = pgEnum('waiver_kind', ['WAIVED', 'OVERRIDDEN']);

/* -------------------------------------------------------------- customers */

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  contact: text('contact').notNull(),
  city: text('city').notNull(),
  terms: text('terms').notNull(),
  account: text('account').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: roleEnum('role').notNull(),
    /** Only customers belong to an account; staff roles carry null. */
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'restrict' }),
    /** Demo accounts are advertised on the sign-in screen and are read-mostly. */
    isDemo: boolean('is_demo').notNull().default(false),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Case-insensitive uniqueness, enforced in the database rather than by
    // remembering to lowercase at every call site: Kim@x and kim@x must never
    // become two accounts. Sign-in looks up through the same expression.
    uniqueIndex('users_email_lower_idx').on(sql`lower(${table.email})`),
    index('users_customer_idx').on(table.customerId),
  ],
);

/**
 * Refresh tokens are stored hashed and one row per session, so signing out
 * revokes exactly one device and a stolen database gives up no usable token.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('refresh_tokens_user_idx').on(table.userId)],
);

/* ------------------------------------------------------------ price matrix */

/**
 * One row per rate, one table per group, all amounts integer. `group` plus
 * `id` is the primary key so the admin grid can address a cell by the same
 * pair the UI already uses.
 */
export const priceRates = pgTable(
  'price_rates',
  {
    group: text('group').notNull(),
    id: text('id').notNull(),
    label: text('label').notNull(),
    /** Whole pesos or integer per-mille depending on the field. Never a float. */
    values: jsonb('values').$type<Record<string, number | string | boolean>>().notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.group, table.id] })],
);

/* ------------------------------------------------------------------- jobs */

export const jobs = pgTable(
  'jobs',
  {
    reference: text('reference').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    description: text('description').notNull(),
    /** The ordered specification. Frozen at proof approval. */
    spec: jsonb('spec').$type<QuoteInput>().notNull(),
    state: jobStateEnum('state').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    proofState: proofStateEnum('proof_state').notNull().default('NONE'),
    proofAt: timestamp('proof_at', { withTimezone: true }),
    preflightReportId: text('preflight_report_id'),
    /** Why a job is held or cancelled. Null at every other state. */
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('jobs_customer_idx').on(table.customerId),
    index('jobs_state_idx').on(table.state),
    // The prepress queue sorts by due time across every customer.
    index('jobs_due_idx').on(table.dueAt),
  ],
);

/**
 * Every state change, ever. The append-only spine of the job: the timeline, the
 * audit answer to "who approved this", and the `stamps` map are all read from
 * here. Nothing deletes from this table.
 */
export const jobEvents = pgTable(
  'job_events',
  {
    id: text('id').primaryKey(),
    jobReference: text('job_reference')
      .notNull()
      .references(() => jobs.reference, { onDelete: 'cascade' }),
    fromState: jobStateEnum('from_state').$type<JobState>(),
    toState: jobStateEnum('to_state').$type<JobState>().notNull(),
    /** User id, or null when the mover was the system (queue, cron). */
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: text('actor_name').notNull(),
    reason: text('reason'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('job_events_job_idx').on(table.jobReference, table.at)],
);

export const jobComments = pgTable(
  'job_comments',
  {
    id: text('id').primaryKey(),
    jobReference: text('job_reference')
      .notNull()
      .references(() => jobs.reference, { onDelete: 'cascade' }),
    author: text('author').notNull(),
    role: roleEnum('role').$type<Role>().notNull(),
    body: text('body').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('job_comments_job_idx').on(table.jobReference, table.at)],
);

export const jobFiles = pgTable(
  'job_files',
  {
    id: text('id').primaryKey(),
    jobReference: text('job_reference')
      .notNull()
      .references(() => jobs.reference, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    bytes: integer('bytes').notNull(),
    /** SHA-256 of the contents. Also the on-disk filename, so re-uploads dedup. */
    contentHash: text('content_hash').notNull(),
    storagePath: text('storage_path').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('job_files_job_idx').on(table.jobReference),
    index('job_files_hash_idx').on(table.contentHash),
  ],
);

/* -------------------------------------------------------------- preflight */

export const preflightReports = pgTable(
  'preflight_reports',
  {
    id: text('id').primaryKey(),
    jobReference: text('job_reference')
      .notNull()
      .references(() => jobs.reference, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    pages: integer('pages').notNull().default(0),
    /** Set when the last check lands. Null while the worker is still running. */
    ranAt: timestamp('ran_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** Populated when the worker itself failed, as distinct from a check failing. */
    error: text('error'),
  },
  (table) => [index('preflight_reports_job_idx').on(table.jobReference)],
);

export const preflightChecks = pgTable(
  'preflight_checks',
  {
    id: text('id').primaryKey(),
    reportId: text('report_id')
      .notNull()
      .references(() => preflightReports.id, { onDelete: 'cascade' }),
    checkId: text('check_id').$type<PreflightCheckId>().notNull(),
    label: text('label').notNull(),
    severity: severityEnum('severity').notNull(),
    measured: text('measured').notNull(),
    tolerance: text('tolerance').notNull(),
    finding: text('finding').notNull(),
    page: text('page').notNull().default(''),
    /** Order the checks ran, so the report replays in a stable sequence. */
    sortOrder: integer('sort_order').notNull().default(0),
    waiver: jsonb('waiver').$type<PreflightWaiver | null>(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('preflight_checks_report_check_idx').on(table.reportId, table.checkId),
    index('preflight_checks_report_idx').on(table.reportId, table.sortOrder),
  ],
);

/* ------------------------------------------------------------- imposition */

export const impositionPlans = pgTable(
  'imposition_plans',
  {
    id: text('id').primaryKey(),
    jobReference: text('job_reference')
      .notNull()
      .references(() => jobs.reference, { onDelete: 'cascade' }),
    /** The whole computed plan. Recomputable from `input`, stored so a plan
     *  signed off in prepress cannot silently change under a rate edit. */
    plan: jsonb('plan').$type<ImpositionPlan>().notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('imposition_plans_job_idx').on(table.jobReference)],
);

/* ---------------------------------------------------------------- presses */

export const presses = pgTable('presses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').$type<'litho' | 'digital'>().notNull(),
  units: text('units').notNull(),
  maxSheet: text('max_sheet').notNull(),
  maxSheetMm: text('max_sheet_mm').notNull(),
  notes: text('notes').notNull().default(''),
  state: pressStateEnum('state').notNull().default('IDLE'),
  jobReference: text('job_reference').references(() => jobs.reference, { onDelete: 'set null' }),
  sheetsRun: integer('sheets_run').notNull().default(0),
  sheetsTarget: integer('sheets_target').notNull().default(0),
  wasteSheets: integer('waste_sheets').notNull().default(0),
  sheetsPerHour: integer('sheets_per_hour').notNull().default(0),
  operator: text('operator').notNull().default(''),
  shift: text('shift').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------- audit log */

/**
 * Written by an interceptor on every mutating request. Deliberately separate
 * from `job_events`: that table is the job's story, this one is the system's.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: text('actor_name').notNull(),
    role: roleEnum('role'),
    method: text('method').notNull(),
    path: text('path').notNull(),
    statusCode: integer('status_code').notNull(),
    /** Request body with credentials stripped. Never contains a password. */
    payload: jsonb('payload').$type<Record<string, unknown> | null>(),
    ip: text('ip'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_log_at_idx').on(table.at), index('audit_log_actor_idx').on(table.actorId)],
);

/* ---------------------------------------------------- inferred row types */

export type CustomerRow = typeof customers.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type JobEventRow = typeof jobEvents.$inferSelect;
export type JobCommentRow = typeof jobComments.$inferSelect;
export type JobFileRow = typeof jobFiles.$inferSelect;
export type PreflightReportRow = typeof preflightReports.$inferSelect;
export type PreflightCheckRow = typeof preflightChecks.$inferSelect;
export type PressRow = typeof presses.$inferSelect;
export type PriceRateRow = typeof priceRates.$inferSelect;
export type ImpositionPlanRow = typeof impositionPlans.$inferSelect;
