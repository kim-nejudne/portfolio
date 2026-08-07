/** Applies pending migrations, then exits. Idempotent. */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to migrate.');
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: `${__dirname}/../../drizzle` });
    console.log('migrations applied');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('migration failed:', error);
  process.exit(1);
});
