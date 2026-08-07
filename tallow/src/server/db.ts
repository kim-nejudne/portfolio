import { Pool, PoolClient } from 'pg';
import { MenuItem, Reservation, ReservationStatus } from '../types.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Covers allowed per 30-minute sitting. Previously lived in db.json but was
// never mutated by any route, so it stays configuration rather than state.
export const MAX_SLOT_COVERS = Number(process.env.MAX_SLOT_COVERS ?? 16);

/** Wait for Postgres to accept connections — the app can boot before the db is ready. */
export async function waitForDb(attempts = 30, delayMs = 1000): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i === attempts) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

type MenuRow = {
  id: string;
  name: string;
  category: string;
  cut_name: string | null;
  weight_grams: number | null;
  aging_days: number | null;
  price: number;
  description: string | null;
  photo_url: string | null;
  is_86: boolean;
  is_dish_of_day: boolean;
  sort_order: number;
};

type ReservationRow = {
  id: string;
  token: string;
  date: string;
  time: string;
  party_size: number;
  name: string;
  email: string;
  phone: string;
  notes: string | null;
  status: string;
  created_at: Date;
};

function toMenuItem(r: MenuRow): MenuItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category as MenuItem['category'],
    cutName: r.cut_name ?? undefined,
    weightGrams: r.weight_grams ?? undefined,
    agingDays: r.aging_days ?? undefined,
    price: r.price,
    description: r.description ?? '',
    photoUrl: r.photo_url ?? undefined,
    is86: r.is_86,
    isDishOfDay: r.is_dish_of_day,
    sortOrder: r.sort_order,
  };
}

function toReservation(r: ReservationRow): Reservation {
  return {
    id: r.id,
    token: r.token,
    date: r.date,
    time: r.time,
    partySize: r.party_size,
    name: r.name,
    email: r.email,
    phone: r.phone,
    notes: r.notes ?? '',
    status: r.status as ReservationStatus,
    createdAt: r.created_at.toISOString(),
  };
}

/* ---------------------------------- menu ---------------------------------- */

export async function getMenu(): Promise<MenuItem[]> {
  const { rows } = await pool.query<MenuRow>(
    'SELECT * FROM menu_items ORDER BY sort_order ASC'
  );
  return rows.map(toMenuItem);
}

export async function setItem86(id: string, is86: boolean): Promise<MenuItem | null> {
  const { rows } = await pool.query<MenuRow>(
    'UPDATE menu_items SET is_86 = $2 WHERE id = $1 RETURNING *',
    [id, is86]
  );
  return rows[0] ? toMenuItem(rows[0]) : null;
}

/** Exactly one item can be dish of the day; passing an unknown id clears it. */
export async function setDishOfTheDay(id: string | null): Promise<MenuItem[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE menu_items SET is_dish_of_day = false WHERE is_dish_of_day');
    if (id) {
      await client.query('UPDATE menu_items SET is_dish_of_day = true WHERE id = $1', [id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getMenu();
}

export async function upsertMenuItem(data: Partial<MenuItem>): Promise<MenuItem[]> {
  if (data.id) {
    const { rowCount } = await pool.query(
      `UPDATE menu_items SET
         name = COALESCE($2, name),
         category = COALESCE($3, category),
         cut_name = $4,
         weight_grams = $5,
         aging_days = $6,
         price = COALESCE($7, price),
         description = COALESCE($8, description),
         photo_url = $9
       WHERE id = $1`,
      [
        data.id,
        data.name ?? null,
        data.category ?? null,
        data.cutName ?? null,
        data.weightGrams ?? null,
        data.agingDays ?? null,
        data.price ?? null,
        data.description ?? null,
        data.photoUrl ?? null,
      ]
    );
    if (rowCount && rowCount > 0) return getMenu();
    // Fall through: an id was supplied for a row that no longer exists.
  }

  const id = data.id ?? 'cut-' + Date.now();
  await pool.query(
    `INSERT INTO menu_items
       (id, name, category, cut_name, weight_grams, aging_days, price, description,
        photo_url, is_86, is_dish_of_day, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,false,
             (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM menu_items))
     ON CONFLICT (id) DO NOTHING`,
    [
      id,
      data.name,
      data.category,
      data.cutName ?? null,
      data.weightGrams ?? null,
      data.agingDays ?? null,
      Number(data.price),
      data.description ?? '',
      data.photoUrl ?? null,
    ]
  );
  return getMenu();
}

export async function deleteMenuItem(id: string): Promise<MenuItem[]> {
  await pool.query('DELETE FROM menu_items WHERE id = $1', [id]);
  return getMenu();
}

/* ------------------------------ reservations ------------------------------ */

export async function getReservationsForDate(date: string): Promise<Reservation[]> {
  const { rows } = await pool.query<ReservationRow>(
    'SELECT * FROM reservations WHERE date = $1 ORDER BY time ASC, created_at ASC',
    [date]
  );
  return rows.map(toReservation);
}

export async function getAllReservations(): Promise<Reservation[]> {
  const { rows } = await pool.query<ReservationRow>(
    'SELECT * FROM reservations ORDER BY date DESC, time ASC'
  );
  return rows.map(toReservation);
}

export async function getReservationByToken(token: string): Promise<Reservation | null> {
  const { rows } = await pool.query<ReservationRow>(
    'SELECT * FROM reservations WHERE UPPER(token) = UPPER($1)',
    [token]
  );
  return rows[0] ? toReservation(rows[0]) : null;
}

/** Covers already committed per sitting time for a date, excluding cancellations. */
export async function getCoversByTime(date: string): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ time: string; covers: string }>(
    `SELECT time, SUM(party_size)::text AS covers
       FROM reservations
      WHERE date = $1 AND status <> 'cancelled'
      GROUP BY time`,
    [date]
  );
  return new Map(rows.map((r) => [r.time, Number(r.covers)]));
}

export async function cancelReservationByToken(token: string): Promise<Reservation | null> {
  const { rows } = await pool.query<ReservationRow>(
    `UPDATE reservations SET status = 'cancelled'
      WHERE UPPER(token) = UPPER($1) RETURNING *`,
    [token]
  );
  return rows[0] ? toReservation(rows[0]) : null;
}

export async function updateReservationStatus(
  id: string,
  status: ReservationStatus
): Promise<Reservation | null> {
  const { rows } = await pool.query<ReservationRow>(
    'UPDATE reservations SET status = $2 WHERE id = $1 RETURNING *',
    [id, status]
  );
  return rows[0] ? toReservation(rows[0]) : null;
}

/**
 * Books a sitting inside a transaction. A transaction-scoped advisory lock keyed
 * on (date, time) serialises concurrent submits for the same sitting, so the
 * capacity check and the insert cannot interleave. This replaces the old
 * in-process mutex, which only held within a single Node process.
 *
 * `check` returns null to accept the booking, or an Error-shaped rejection.
 */
export async function bookSitting<T>(
  date: string,
  time: string,
  fn: (ctx: { client: PoolClient; coversByTime: Map<string, number> }) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${date}|${time}`]);

    const { rows } = await client.query<{ time: string; covers: string }>(
      `SELECT time, SUM(party_size)::text AS covers
         FROM reservations
        WHERE date = $1 AND status <> 'cancelled'
        GROUP BY time`,
      [date]
    );
    const coversByTime = new Map(rows.map((r) => [r.time, Number(r.covers)]));

    const result = await fn({ client, coversByTime });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function insertReservation(
  client: PoolClient,
  r: Reservation
): Promise<Reservation> {
  const { rows } = await client.query<ReservationRow>(
    `INSERT INTO reservations
       (id, token, date, time, party_size, name, email, phone, notes, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [r.id, r.token, r.date, r.time, r.partySize, r.name, r.email, r.phone, r.notes ?? '', r.status, new Date(r.createdAt)]
  );
  return toReservation(rows[0]);
}
