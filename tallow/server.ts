import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { MenuItem, Reservation, TimeSlotAvailability, CoverSummary } from './src/types.js';
import {
  MAX_SLOT_COVERS,
  waitForDb,
  getMenu,
  setItem86,
  setDishOfTheDay,
  upsertMenuItem,
  deleteMenuItem,
  getAllReservations,
  getReservationsForDate,
  getReservationByToken,
  getCoversByTime,
  cancelReservationByToken,
  updateReservationStatus,
  bookSitting,
  insertReservation,
} from './src/server/db.js';
import {
  assertAuthConfig,
  mintToken,
  roleForPin,
  requireSession,
  requireStaff,
  rateLimitAuth,
  clearRateLimit,
} from './src/server/auth.js';

dotenv.config();

const ALL_SITTING_TIMES = [
  '17:00', '17:30', '18:00', '18:30', '19:00',
  '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

const VALID_STATUSES = ['confirmed', 'seated', 'completed', 'cancelled'] as const;

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function newToken() {
  return 'TAL-' + crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}

/** Wraps an async route so a rejected promise becomes a 500 instead of an unhandled rejection. */
function route(
  handler: (req: express.Request, res: express.Response) => Promise<unknown>
): express.RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT ?? 3000);

  // nginx is the only thing in front of us, so exactly one proxy hop is trusted.
  // Without this every client shares nginx's IP and the sign-in limiter becomes global.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  // Fail at boot rather than 500ing on the first sign-in attempt. A missing
  // secret means no session can be minted, so the dashboard is unreachable —
  // better to refuse to start and have the healthcheck catch it.
  assertAuthConfig();

  await waitForDb();

  // API Routes

  // 1. Get Menu (Guest & Staff)
  app.get('/api/menu', route(async (_req, res) => {
    res.json(await getMenu());
  }));

  // 2. Staff Auth — issues a signed session carrying the role the PIN maps to.
  app.post('/api/admin/auth', rateLimitAuth, (req, res) => {
    const role = roleForPin(req.body?.pin);
    if (!role) {
      return res.status(401).json({ success: false, error: 'Invalid staff security PIN.' });
    }
    clearRateLimit(req);
    return res.json({ success: true, token: mintToken(role), role });
  });

  // Advertises the demo PIN so the sign-in screen can show it without the value
  // being baked into the client bundle. Absent when no demo PIN is configured.
  app.get('/api/admin/demo-hint', (_req, res) => {
    const demoPin = process.env.DEMO_PIN;
    return res.json({ demoPin: demoPin || null });
  });

  // 3. Toggle 86 Board Status (Staff)
  app.post('/api/admin/86', requireStaff, route(async (req, res) => {
    const { menuItemId, is86 } = req.body ?? {};
    if (!menuItemId) {
      return res.status(400).json({ error: 'Missing menuItemId' });
    }

    const item = await setItem86(menuItemId, Boolean(is86));
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    return res.json({ success: true, item });
  }));

  // 4. Set Dish of the Day (Staff)
  app.post('/api/admin/dish-of-the-day', requireStaff, route(async (req, res) => {
    const { menuItemId } = req.body ?? {};
    const menuItems = await setDishOfTheDay(menuItemId ?? null);
    return res.json({ success: true, menuItems });
  }));

  // 5. Menu CRUD (Staff)
  app.post('/api/admin/menu/save', requireStaff, route(async (req, res) => {
    const itemData: Partial<MenuItem> = req.body ?? {};
    if (!itemData.name || !itemData.category || !itemData.price) {
      return res.status(400).json({ error: 'Name, category, and price are required.' });
    }
    if (isNaN(Number(itemData.price))) {
      return res.status(400).json({ error: 'Price must be a number.' });
    }

    const menuItems = await upsertMenuItem(itemData);
    return res.json({ success: true, menuItems });
  }));

  // Delete Menu Item (Staff)
  app.delete('/api/admin/menu/:id', requireStaff, route(async (req, res) => {
    const menuItems = await deleteMenuItem(req.params.id);
    return res.json({ success: true, menuItems });
  }));

  // 6. Query Time Slot Availability
  app.get('/api/reservations/availability', route(async (req, res) => {
    const date = (req.query.date as string) || todayISO();
    const partySize = parseInt((req.query.partySize as string) || '2', 10);

    const coversByTime = await getCoversByTime(date);

    const slots: TimeSlotAvailability[] = ALL_SITTING_TIMES.map((time) => {
      const totalCoversBooked = coversByTime.get(time) ?? 0;
      const availableCovers = MAX_SLOT_COVERS - totalCoversBooked;
      const isAvailable = availableCovers >= partySize;

      return {
        time,
        totalCoversBooked,
        maxCovers: MAX_SLOT_COVERS,
        availableCovers,
        isAvailable,
        reason: isAvailable
          ? undefined
          : availableCovers === 0
          ? 'Fully booked sitting'
          : `Only ${availableCovers} covers remain`,
      };
    });

    return res.json({ date, partySize, slots });
  }));

  // 7. Atomic Reservation Creation (serialised per sitting by a DB advisory lock)
  app.post('/api/reservations', route(async (req, res) => {
    const { date, time, partySize, name, email, phone, notes } = req.body ?? {};

    if (!date || !time || !partySize || !name || !email || !phone) {
      return res.status(400).json({ error: 'All fields (date, time, party size, name, email, phone) are required.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
    }
    if (!ALL_SITTING_TIMES.includes(time)) {
      return res.status(400).json({ error: 'That sitting time is not on the service schedule.' });
    }

    const requestedParty = parseInt(partySize, 10);
    if (isNaN(requestedParty) || requestedParty < 1 || requestedParty > 12) {
      return res.status(400).json({ error: 'Party size must be between 1 and 12 guests.' });
    }
    for (const [field, value] of Object.entries({ name, email, phone })) {
      if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200) {
        return res.status(400).json({ error: `Invalid ${field}.` });
      }
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (typeof notes === 'string' && notes.length > 1000) {
      return res.status(400).json({ error: 'Notes must be under 1000 characters.' });
    }

    const outcome = await bookSitting(date, time, async ({ client, coversByTime }) => {
      const currentCovers = coversByTime.get(time) ?? 0;
      const remainingCovers = MAX_SLOT_COVERS - currentCovers;

      if (requestedParty > remainingCovers) {
        // Honest capacity error with specific alternative availability.
        const alternativeTimes = ALL_SITTING_TIMES.map((t) => ({
          time: t,
          available: MAX_SLOT_COVERS - (coversByTime.get(t) ?? 0),
        })).filter((t) => t.available >= requestedParty && t.time !== time);

        const altString = alternativeTimes.length > 0
          ? ` Available alternative sittings for ${requestedParty} guests on ${date}: ${alternativeTimes.map((a) => `${a.time} (${a.available} covers open)`).join(', ')}.`
          : ` No other sittings have ${requestedParty} contiguous covers open on this date.`;

        const errorMsg = remainingCovers <= 0
          ? `The ${time} sitting on ${date} is fully committed.${altString}`
          : `Only ${remainingCovers} covers remain for the ${time} sitting on ${date} (requested ${requestedParty}).${altString}`;

        return { conflict: { error: errorMsg, remainingCovers, alternativeTimes } };
      }

      const reservation: Reservation = {
        id: 'res-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
        token: newToken(),
        date,
        time,
        partySize: requestedParty,
        name: String(name).trim(),
        email: String(email).trim(),
        phone: String(phone).trim(),
        notes: typeof notes === 'string' ? notes.trim() : '',
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };

      return { reservation: await insertReservation(client, reservation) };
    });

    if ('conflict' in outcome && outcome.conflict) {
      return res.status(409).json(outcome.conflict);
    }
    return res.status(201).json({ success: true, reservation: outcome.reservation });
  }));

  // 8. Fetch Reservation by Tokenized Link (No account needed)
  app.get('/api/reservations/token/:token', route(async (req, res) => {
    const reservation = await getReservationByToken(req.params.token);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation booking not found for token: ' + req.params.token });
    }
    return res.json({ reservation });
  }));

  // 9. Cancel Reservation by Token
  app.post('/api/reservations/cancel-by-token', route(async (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'A booking token is required.' });
    }
    const reservation = await cancelReservationByToken(token);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }
    return res.json({ success: true, reservation });
  }));

  // 10. Staff Reservations Dashboard API
  app.get('/api/admin/reservations', requireSession, route(async (req, res) => {
    const date = (req.query.date as string) || todayISO();

    const dayReservations = await getReservationsForDate(date);
    const active = dayReservations.filter((r) => r.status !== 'cancelled');

    const coversIn = (from: string, to?: string) =>
      active
        .filter((r) => r.time >= from && (to === undefined || r.time < to))
        .reduce((s, r) => s + r.partySize, 0);

    const summary: CoverSummary = {
      date,
      totalReservations: active.length,
      totalCovers: active.reduce((sum, r) => sum + r.partySize, 0),
      maxDailyCapacity: ALL_SITTING_TIMES.length * MAX_SLOT_COVERS,
      sittingCounts: {
        early: coversIn('17:00', '18:30'),
        prime: coversIn('18:30', '20:30'),
        late: coversIn('20:30'),
      },
    };

    return res.json({ summary, reservations: await getAllReservations() });
  }));

  // 11. Update Reservation Status (Staff)
  app.patch('/api/admin/reservations/:id/status', requireStaff, route(async (req, res) => {
    const { status } = req.body ?? {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}.` });
    }

    const reservation = await updateReservationStatus(req.params.id, status);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }
    return res.json({ success: true, reservation });
  }));

  // Vite development vs production asset handling
  if (process.env.NODE_ENV !== 'production') {
    // Imported dynamically so the production bundle never requires Vite at runtime.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled route error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TALLOW server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
