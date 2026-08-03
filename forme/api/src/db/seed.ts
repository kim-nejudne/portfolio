/**
 * Seeds a database from the fixtures the frontend scaffold shipped with.
 *
 * Idempotent by "are the tables empty", the same guard TALLOW uses: running it
 * against a populated database is a no-op, so it is safe in a container start
 * sequence and safe to run twice by hand.
 *
 * The one transformation worth noting: fixture jobs carry a `stamps` map, but
 * this schema derives stamps from `job_events`. Each stamp is therefore written
 * back out as an event, in chronological order, so a seeded database and a
 * database built by real use have the same shape.
 */
import { randomUUID } from 'node:crypto';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { JOB_STATE_SEQUENCE, type JobState, type Role } from '@forme/domain';
import * as schema from './schema';
import { CUSTOMERS } from './seed-data/customers';
import { JOB_RECORDS } from './seed-data/jobs';
import { PREFLIGHT_REPORTS } from './seed-data/preflight';
import { PRESSES } from './seed-data/presses';
import { PRICE_MATRIX } from './seed-data/pricing';

type Db = NodePgDatabase<typeof schema>;

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'forme-demo-2026';

/**
 * One demo account per role so every surface is walkable without credentials.
 * All are flagged `isDemo`, which DenyDemoWritesGuard turns into read-only.
 */
const DEMO_USERS: { email: string; name: string; role: Role; customerId: string | null }[] = [
  { email: 'customer@forme.demo', name: 'Nine Dots Studio', role: 'customer', customerId: 'nine-dots' },
  { email: 'prepress@forme.demo', name: 'R. Salcedo', role: 'prepress', customerId: null },
  { email: 'floor@forme.demo', name: 'M. Bautista', role: 'floor', customerId: null },
  { email: 'admin@forme.demo', name: 'A. Reyes', role: 'admin', customerId: null },
];

async function isEmpty(db: Db): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(schema.customers);
  return Number(row?.count ?? '0') === 0;
}

async function seedCustomers(db: Db): Promise<void> {
  await db.insert(schema.customers).values(
    CUSTOMERS.map((customer) => ({
      id: customer.id,
      name: customer.name,
      shortName: customer.shortName,
      contact: customer.contact,
      city: customer.city,
      terms: customer.terms,
      account: customer.account,
    })),
  );
}

async function seedUsers(db: Db): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  await db.insert(schema.users).values(
    DEMO_USERS.map((user) => ({
      id: randomUUID(),
      email: user.email,
      passwordHash,
      name: user.name,
      role: user.role,
      customerId: user.customerId,
      isDemo: true,
    })),
  );
}

async function seedPricing(db: Db): Promise<void> {
  const rows: (typeof schema.priceRates.$inferInsert)[] = [];
  let order = 0;

  const push = (
    group: string,
    id: string,
    label: string,
    values: Record<string, number | string | boolean>,
  ): void => {
    rows.push({ group, id, label, values, sortOrder: order++ });
  };

  for (const rate of PRICE_MATRIX.products) {
    push('products', rate.id, rate.label, {
      setup: rate.setup,
      perThousand: rate.perThousand,
      note: rate.note,
    });
  }
  for (const rate of PRICE_MATRIX.stocks) {
    push('stocks', rate.id, rate.label, {
      gsm: rate.gsm,
      coated: rate.coated,
      inkLimit: rate.inkLimit,
      multiplier: rate.multiplier,
    });
  }
  for (const rate of PRICE_MATRIX.quantityBreaks) {
    push('quantityBreaks', rate.quantity.toString(), `${rate.quantity}`, {
      quantity: rate.quantity,
      multiplier: rate.multiplier,
    });
  }
  for (const rate of PRICE_MATRIX.finishing) {
    push('finishing', rate.id, rate.label, {
      perThousand: rate.perThousand,
      flat: rate.flat,
      bindery: rate.bindery,
    });
  }
  for (const rate of PRICE_MATRIX.turnarounds) {
    push('turnarounds', rate.id, rate.label, {
      workingDays: rate.workingDays,
      multiplier: rate.multiplier,
    });
  }
  for (const rate of PRICE_MATRIX.colours) {
    push('colours', rate.id, rate.label, { plates: rate.plates, multiplier: rate.multiplier });
  }
  for (const rate of PRICE_MATRIX.sizes) {
    push('sizes', rate.id, rate.label, { widthMm: rate.widthMm, heightMm: rate.heightMm });
  }

  await db.insert(schema.priceRates).values(rows);
}

async function seedJobs(db: Db): Promise<void> {
  await db.insert(schema.jobs).values(
    JOB_RECORDS.map((record) => ({
      reference: record.reference,
      customerId: record.customerId,
      description: record.description,
      spec: record.spec,
      state: record.state,
      receivedAt: new Date(record.receivedAt),
      dueAt: new Date(record.dueAt),
      proofState: record.proofState,
      proofAt: record.proofAt ? new Date(record.proofAt) : null,
      preflightReportId: record.preflightReportId,
      note: record.note,
    })),
  );

  // Stamps → events. Ordered by timestamp so the derived timeline reads the
  // same way it would if the job had actually walked the shop floor.
  const events: (typeof schema.jobEvents.$inferInsert)[] = [];
  for (const record of JOB_RECORDS) {
    const stamped = Object.entries(record.stamps)
      .filter((entry): entry is [JobState, string] => typeof entry[1] === 'string')
      .sort((a, b) => Date.parse(a[1]) - Date.parse(b[1]));

    let previous: JobState | null = null;
    for (const [state, at] of stamped) {
      events.push({
        id: randomUUID(),
        jobReference: record.reference,
        fromState: previous,
        toState: state,
        actorId: null,
        actorName: actorFor(state),
        at: new Date(at),
      });
      previous = state;
    }
  }
  if (events.length > 0) await db.insert(schema.jobEvents).values(events);

  const comments = JOB_RECORDS.flatMap((record) =>
    record.comments.map((comment) => ({
      id: comment.id,
      jobReference: record.reference,
      author: comment.author,
      role: comment.role,
      body: comment.body,
      at: new Date(comment.at),
    })),
  );
  if (comments.length > 0) await db.insert(schema.jobComments).values(comments);

  const files = JOB_RECORDS.flatMap((record) =>
    record.files.map((file) => ({
      id: randomUUID(),
      jobReference: record.reference,
      name: file.name,
      kind: file.kind,
      bytes: file.bytes,
      // Seeded jobs have no artwork on disk. The hash is a placeholder marker
      // rather than a real digest, and no code path serves these bytes.
      contentHash: 'seed',
      storagePath: '',
      at: new Date(file.at),
    })),
  );
  if (files.length > 0) await db.insert(schema.jobFiles).values(files);
}

/** Who moved a job, for seeded history. Automated states carry the system name. */
function actorFor(state: JobState): string {
  if (state === 'PREFLIGHT' || state === 'IMPOSED') return 'FORME';
  if (state === 'APPROVED') return 'Customer';
  return 'R. Salcedo';
}

async function seedPreflight(db: Db): Promise<void> {
  const references = new Set(JOB_RECORDS.map((record) => record.reference));
  // The intake report belongs to a job that does not exist in the fixtures; it
  // existed only to drive the scaffold's upload animation. Real uploads now
  // produce real reports, so it has nothing to attach to.
  const reports = PREFLIGHT_REPORTS.filter((report) => references.has(report.jobReference));

  if (reports.length === 0) return;

  await db.insert(schema.preflightReports).values(
    reports.map((report) => ({
      id: report.id,
      jobReference: report.jobReference,
      fileName: report.fileName,
      pages: report.pages,
      ranAt: new Date(report.ranAt),
      startedAt: new Date(report.ranAt),
    })),
  );

  await db.insert(schema.preflightChecks).values(
    reports.flatMap((report) =>
      report.checks.map((check, index) => ({
        id: randomUUID(),
        reportId: report.id,
        checkId: check.id,
        label: check.label,
        severity: check.severity,
        measured: check.measured,
        tolerance: check.tolerance,
        finding: check.finding,
        page: check.page,
        sortOrder: index,
        waiver: check.waiver,
      })),
    ),
  );
}

async function seedPresses(db: Db): Promise<void> {
  const references = new Set(JOB_RECORDS.map((record) => record.reference));
  await db.insert(schema.presses).values(
    PRESSES.map((press, index) => ({
      id: press.id,
      name: press.name,
      kind: press.kind,
      units: press.units,
      maxSheet: press.maxSheet,
      maxSheetMm: press.maxSheetMm,
      notes: press.notes,
      state: press.state,
      jobReference:
        press.jobReference && references.has(press.jobReference) ? press.jobReference : null,
      sheetsRun: press.sheetsRun,
      sheetsTarget: press.sheetsTarget,
      wasteSheets: press.wasteSheets,
      sheetsPerHour: press.sheetsPerHour,
      operator: press.operator,
      shift: press.shift,
      sortOrder: index,
    })),
  );
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to seed.');

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    if (!(await isEmpty(db))) {
      console.log('database already seeded; nothing to do');
      return;
    }

    await seedCustomers(db);
    await seedUsers(db);
    await seedPricing(db);
    await seedJobs(db);
    await seedPreflight(db);
    await seedPresses(db);

    console.log(
      `seeded ${CUSTOMERS.length} customers, ${DEMO_USERS.length} demo users, ` +
        `${JOB_RECORDS.length} jobs, ${PRESSES.length} presses`,
    );
    console.log(`demo password: ${DEMO_PASSWORD}`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('seed failed:', error);
  process.exit(1);
});

export { JOB_STATE_SEQUENCE };
