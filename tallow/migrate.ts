// Side-effect form, first, for the same reason as in server.ts: env has to be
// populated before any imported module body reads it.
import 'dotenv/config';

import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import { INITIAL_MENU_ITEMS, INITIAL_RESERVATIONS } from './src/data/initialData.js';
import { MenuItem, Reservation } from './src/types.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    category VARCHAR NOT NULL,
    cut_name VARCHAR,
    weight_grams INTEGER,
    aging_days INTEGER,
    price INTEGER NOT NULL,
    description TEXT,
    photo_url VARCHAR,
    is_86 BOOLEAN NOT NULL DEFAULT false,
    is_dish_of_day BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id VARCHAR PRIMARY KEY,
    token VARCHAR UNIQUE NOT NULL,
    date VARCHAR NOT NULL,
    time VARCHAR NOT NULL,
    party_size INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    phone VARCHAR NOT NULL,
    notes TEXT,
    status VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL
  );

  -- Availability is always queried by date, and the dashboard sorts within a date.
  CREATE INDEX IF NOT EXISTS reservations_date_time_idx ON reservations (date, time);
  -- Guest lookup is by token, case-insensitively.
  CREATE INDEX IF NOT EXISTS reservations_token_upper_idx ON reservations (UPPER(token));

  -- One row per applied data migration. Seeding is guarded by "are the tables
  -- empty", which says nothing about whether a long-lived database has had a
  -- given rewrite applied — this table is what makes that answerable.
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT now()
  );
`;

/**
 * Data migrations, in order. Each runs at most once per database.
 *
 * These rewrite rows that already exist; they are not schema changes. A
 * database seeded *after* a migration was written already has the shape that
 * migration produces, so `runMigration` records it as applied without running
 * it — see the baseline path below.
 */
const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_gbp_to_php',
    // TALLOW re-priced from pounds to Philippine pesos at ₱75/£1, rounded to
    // the nearest ₱50 so a typeset menu keeps round numbers.
    //
    // Arithmetic rather than a hardcoded per-id table, so prices added or
    // edited through the staff dashboard convert alongside the seeded ones.
    //
    // The ::numeric cast is load-bearing: ROUND() on double precision rounds
    // half to even, which turns £135 (₱10,125) into ₱10,100. On numeric it
    // rounds half away from zero and gives the intended ₱10,150.
    sql: `UPDATE menu_items SET price = (ROUND((price * 75)::numeric / 50) * 50)::int`,
  },
];

/** Seed data comes from db.json when a local flat-file DB exists, else the bundled defaults. */
function seedSource(): { menuItems: MenuItem[]; reservations: Reservation[]; from: string } {
  const dbFilePath = path.join(process.cwd(), 'data', 'db.json');
  if (fs.existsSync(dbFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dbFilePath, 'utf-8'));
      if (Array.isArray(data.menuItems) && Array.isArray(data.reservations)) {
        return { menuItems: data.menuItems, reservations: data.reservations, from: 'data/db.json' };
      }
      console.warn('data/db.json is missing menuItems/reservations — falling back to defaults.');
    } catch (err) {
      console.warn('data/db.json could not be parsed — falling back to defaults:', err);
    }
  }
  return { menuItems: INITIAL_MENU_ITEMS, reservations: INITIAL_RESERVATIONS, from: 'bundled defaults' };
}

/**
 * Run any migration this database has not recorded yet.
 *
 * `baseline` means the rows were just inserted from the current seed file and
 * therefore already reflect every migration written so far: record them as
 * applied rather than running them. Without that, seeding a fresh database
 * from the peso seed file and then running 001 would convert pesos to pesos.
 */
async function applyPendingMigrations(client: PoolClient, baseline: boolean) {
  const { rows } = await client.query<{ id: string }>('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.id));
  const pending = MIGRATIONS.filter((m) => !applied.has(m.id));

  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  for (const migration of pending) {
    await client.query('BEGIN');
    try {
      if (baseline) {
        console.log(`Baselining ${migration.id} — freshly seeded data is already in its target shape.`);
      } else {
        const result = await client.query(migration.sql);
        console.log(`Applied ${migration.id} — ${result.rowCount} row(s) rewritten.`);
      }
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    }
  }
}

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Applying schema...');
    await client.query(SCHEMA);

    const { rows } = await client.query<{ menu: string; res: string }>(
      `SELECT (SELECT COUNT(*) FROM menu_items)::text AS menu,
              (SELECT COUNT(*) FROM reservations)::text AS res`
    );
    const menuCount = Number(rows[0].menu);
    const resCount = Number(rows[0].res);

    if (menuCount > 0 && resCount > 0) {
      console.log(`Already seeded (${menuCount} menu items, ${resCount} reservations) — skipping seed.`);
      // Rows predate this run, so they are not necessarily in the current
      // shape: migrations have to actually run against them.
      await applyPendingMigrations(client, false);
      return;
    }

    const { menuItems, reservations, from } = seedSource();
    console.log(`Seeding from ${from}...`);

    await client.query('BEGIN');

    for (const [i, item] of menuItems.entries()) {
      await client.query(
        `INSERT INTO menu_items
           (id, name, category, cut_name, weight_grams, aging_days, price, description,
            photo_url, is_86, is_dish_of_day, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id, item.name, item.category, item.cutName ?? null, item.weightGrams ?? null,
          item.agingDays ?? null, item.price, item.description ?? '', item.photoUrl ?? null,
          item.is86 ?? false, item.isDishOfDay ?? false, item.sortOrder ?? i + 1,
        ]
      );
    }

    for (const res of reservations) {
      await client.query(
        `INSERT INTO reservations
           (id, token, date, time, party_size, name, email, phone, notes, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [
          res.id, res.token, res.date, res.time, res.partySize, res.name, res.email,
          res.phone, res.notes ?? '', res.status, new Date(res.createdAt),
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`Seeded ${menuItems.length} menu items, ${reservations.length} reservations.`);

    // Baseline only when menu_items was genuinely empty, because that is the
    // one case where every menu row came from the current seed file. If the
    // table already held rows and we came down this path because
    // *reservations* was empty, the ON CONFLICT above left those menu rows
    // untouched and they still need converting.
    await applyPendingMigrations(client, menuCount === 0);
    console.log('Migration complete.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // Exit non-zero: the app container waits on this step and must not start
    // against a half-migrated database.
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
