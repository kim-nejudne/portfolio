import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';

/**
 * The e2e suite runs against a real Postgres, not a mock and not an in-memory
 * shim. Almost everything worth asserting here — the `FOR UPDATE` in the state
 * machine, the advisory lock behind reference allocation, `DISTINCT ON` for
 * stamps, the case-insensitive unique index on email — is database behaviour.
 * A fake would assert that the fake works.
 *
 * The database is dropped and recreated per run, so the suite never depends on
 * what a previous run left behind.
 */
export const TEST_DATABASE = process.env.TEST_DATABASE ?? 'forme_test';

/** env.setup.ts has already pointed DATABASE_URL at the test database. */
export function testDatabaseUrl(): string {
  return process.env.DATABASE_URL as string;
}

function adminUrl(): string {
  return testDatabaseUrl().replace(/\/[^/]*$/, '/postgres');
}

export async function resetTestDatabase(): Promise<void> {
  const admin = new Client({ connectionString: adminUrl() });
  await admin.connect();
  try {
    // Terminate stragglers first, or DROP blocks on an open connection.
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DATABASE],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DATABASE}`);
    await admin.query(`CREATE DATABASE ${TEST_DATABASE}`);
  } finally {
    await admin.end();
  }

  // Absolute paths: a jest worker's cwd is not guaranteed to be the package
  // root, and a relative path here fails as a missing module rather than as
  // anything that points at the real cause.
  const dist = join(__dirname, '..', 'dist', 'db');
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl() };
  execFileSync('node', [join(dist, 'migrate.js')], { env, stdio: 'pipe' });
  execFileSync('node', [join(dist, 'seed.js')], { env, stdio: 'pipe' });
}
