/**
 * Runs before the test file is imported.
 *
 * AppModule calls ConfigModule.forRoot() at import time, so anything set in a
 * beforeAll hook is already too late — the environment has to be complete
 * before the first `import` of the module under test.
 */
const base = process.env.DATABASE_URL ?? 'postgresql://forme:forme@localhost:5434/forme';
const database = process.env.TEST_DATABASE ?? 'forme_test';

process.env.DATABASE_URL = base.replace(/\/[^/]*$/, `/${database}`);
process.env.JWT_SECRET ??= 'forme-e2e-secret-at-least-32-characters-long';
process.env.DEMO_PASSWORD ??= 'forme-demo-2026';
// Keep the artwork directory out of the working tree during tests.
process.env.ARTWORK_DIR ??= '/tmp/forme-e2e-artwork';
