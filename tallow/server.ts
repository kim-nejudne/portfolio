import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { INITIAL_MENU_ITEMS, INITIAL_RESERVATIONS } from './src/data/initialData.js';
import { MenuItem, Reservation, TimeSlotAvailability, CoverSummary } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DBState {
  menuItems: MenuItem[];
  reservations: Reservation[];
  maxSlotCovers: number; // Max covers allowed per 30-minute sitting slot
}

// Load or initialize database
function loadDB(): DBState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading DB file, using defaults:', err);
  }

  const initialState: DBState = {
    menuItems: INITIAL_MENU_ITEMS,
    reservations: INITIAL_RESERVATIONS,
    maxSlotCovers: 16,
  };
  saveDB(initialState);
  return initialState;
}

function saveDB(state: DBState) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB file:', err);
  }
}

// Simple in-memory atomic mutex to handle concurrent reservation submits
let isMutatingReservation = false;
const mutexQueue: Array<() => void> = [];

function acquireMutex(): Promise<void> {
  return new Promise((resolve) => {
    if (!isMutatingReservation) {
      isMutatingReservation = true;
      resolve();
    } else {
      mutexQueue.push(resolve);
    }
  });
}

function releaseMutex() {
  if (mutexQueue.length > 0) {
    const next = mutexQueue.shift();
    if (next) next();
  } else {
    isMutatingReservation = false;
  }
}

const ALL_SITTING_TIMES = [
  '17:00', '17:30', '18:00', '18:30', '19:00',
  '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes

  // 1. Get Menu (Guest & Staff)
  app.get('/api/menu', (req, res) => {
    const db = loadDB();
    const sorted = [...db.menuItems].sort((a, b) => a.sortOrder - b.sortOrder);
    res.json(sorted);
  });

  // 2. Staff Auth
  app.post('/api/admin/auth', (req, res) => {
    const { pin } = req.body;
    if (pin === 'tallow123' || pin === 'TALLOW123') {
      return res.json({ success: true, token: 'staff-session-active-token' });
    }
    return res.status(401).json({ success: false, error: 'Invalid staff security PIN. (Default PIN: tallow123)' });
  });

  // 3. Toggle 86 Board Status (Staff)
  app.post('/api/admin/86', (req, res) => {
    const { menuItemId, is86 } = req.body;
    if (!menuItemId) {
      return res.status(400).json({ error: 'Missing menuItemId' });
    }

    const db = loadDB();
    const item = db.menuItems.find((i) => i.id === menuItemId);
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    item.is86 = Boolean(is86);
    saveDB(db);

    return res.json({ success: true, item });
  });

  // 4. Set Dish of the Day (Staff)
  app.post('/api/admin/dish-of-the-day', (req, res) => {
    const { menuItemId } = req.body;
    const db = loadDB();

    db.menuItems.forEach((i) => {
      i.isDishOfDay = i.id === menuItemId;
    });

    saveDB(db);
    return res.json({ success: true, menuItems: db.menuItems });
  });

  // 5. Menu CRUD (Staff)
  app.post('/api/admin/menu/save', (req, res) => {
    const itemData: Partial<MenuItem> = req.body;
    if (!itemData.name || !itemData.category || !itemData.price) {
      return res.status(400).json({ error: 'Name, category, and price are required.' });
    }

    const db = loadDB();
    if (itemData.id) {
      const idx = db.menuItems.findIndex((i) => i.id === itemData.id);
      if (idx !== -1) {
        db.menuItems[idx] = { ...db.menuItems[idx], ...itemData };
      } else {
        db.menuItems.push(itemData as MenuItem);
      }
    } else {
      const newItem: MenuItem = {
        id: 'cut-' + Date.now(),
        name: itemData.name,
        category: itemData.category,
        cutName: itemData.cutName,
        weightGrams: itemData.weightGrams,
        agingDays: itemData.agingDays,
        price: Number(itemData.price),
        description: itemData.description || '',
        photoUrl: itemData.photoUrl,
        is86: false,
        isDishOfDay: false,
        sortOrder: db.menuItems.length + 1,
      };
      db.menuItems.push(newItem);
    }

    saveDB(db);
    return res.json({ success: true, menuItems: db.menuItems });
  });

  // Delete Menu Item (Staff)
  app.delete('/api/admin/menu/:id', (req, res) => {
    const { id } = req.params;
    const db = loadDB();
    db.menuItems = db.menuItems.filter((i) => i.id !== id);
    saveDB(db);
    return res.json({ success: true, menuItems: db.menuItems });
  });

  // 6. Query Time Slot Availability
  app.get('/api/reservations/availability', (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const partySize = parseInt((req.query.partySize as string) || '2', 10);

    const db = loadDB();
    const maxCovers = db.maxSlotCovers;

    const slots: TimeSlotAvailability[] = ALL_SITTING_TIMES.map((time) => {
      const activeBookings = db.reservations.filter(
        (r) => r.date === date && r.time === time && r.status !== 'cancelled'
      );
      const totalCoversBooked = activeBookings.reduce((sum, r) => sum + r.partySize, 0);
      const availableCovers = maxCovers - totalCoversBooked;
      const isAvailable = availableCovers >= partySize;

      return {
        time,
        totalCoversBooked,
        maxCovers,
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
  });

  // 7. Atomic Reservation Creation (Enforced at DB level under concurrent submits)
  app.post('/api/reservations', async (req, res) => {
    const { date, time, partySize, name, email, phone, notes } = req.body;

    if (!date || !time || !partySize || !name || !email || !phone) {
      return res.status(400).json({ error: 'All fields (date, time, party size, name, email, phone) are required.' });
    }

    const requestedParty = parseInt(partySize, 10);
    if (isNaN(requestedParty) || requestedParty < 1 || requestedParty > 12) {
      return res.status(400).json({ error: 'Party size must be between 1 and 12 guests.' });
    }

    await acquireMutex();
    try {
      const db = loadDB();
      const maxCovers = db.maxSlotCovers;

      const activeBookings = db.reservations.filter(
        (r) => r.date === date && r.time === time && r.status !== 'cancelled'
      );
      const currentCovers = activeBookings.reduce((sum, r) => sum + r.partySize, 0);
      const remainingCovers = maxCovers - currentCovers;

      if (requestedParty > remainingCovers) {
        // Honest capacity error with specific alternative availability!
        const alternativeTimes = ALL_SITTING_TIMES.map((t) => {
          const tBookings = db.reservations.filter(
            (r) => r.date === date && r.time === t && r.status !== 'cancelled'
          );
          const tCovers = tBookings.reduce((sum, r) => sum + r.partySize, 0);
          const avail = maxCovers - tCovers;
          return { time: t, available: avail };
        }).filter((t) => t.available >= requestedParty && t.time !== time);

        const altString = alternativeTimes.length > 0
          ? ` Available alternative sittings for ${requestedParty} guests on ${date}: ${alternativeTimes.map((a) => `${a.time} (${a.available} covers open)`).join(', ')}.`
          : ` No other sittings have ${requestedParty} contiguous covers open on this date.`;

        const errorMsg = remainingCovers <= 0
          ? `The ${time} sitting on ${date} is fully committed.${altString}`
          : `Only ${remainingCovers} covers remain for the ${time} sitting on ${date} (requested ${requestedParty}).${altString}`;

        return res.status(409).json({ error: errorMsg, remainingCovers, alternativeTimes });
      }

      // Generate unique token
      const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
      const token = `TAL-${randomHex}`;

      const newReservation: Reservation = {
        id: 'res-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        token,
        date,
        time,
        partySize: requestedParty,
        name,
        email,
        phone,
        notes: notes || '',
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      };

      db.reservations.push(newReservation);
      saveDB(db);

      return res.status(201).json({ success: true, reservation: newReservation });
    } finally {
      releaseMutex();
    }
  });

  // 8. Fetch Reservation by Tokenized Link (No account needed)
  app.get('/api/reservations/token/:token', (req, res) => {
    const { token } = req.params;
    const db = loadDB();
    const reservation = db.reservations.find(
      (r) => r.token.toUpperCase() === token.toUpperCase()
    );

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation booking not found for token: ' + token });
    }

    return res.json({ reservation });
  });

  // 9. Cancel Reservation by Token
  app.post('/api/reservations/cancel-by-token', async (req, res) => {
    const { token } = req.body;
    await acquireMutex();
    try {
      const db = loadDB();
      const reservation = db.reservations.find((r) => r.token.toUpperCase() === token?.toUpperCase());
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found.' });
      }
      reservation.status = 'cancelled';
      saveDB(db);
      return res.json({ success: true, reservation });
    } finally {
      releaseMutex();
    }
  });

  // 10. Staff Reservations Dashboard API
  app.get('/api/admin/reservations', (req, res) => {
    const db = loadDB();
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const dayReservations = db.reservations.filter((r) => r.date === date);
    const totalCovers = dayReservations
      .filter((r) => r.status !== 'cancelled')
      .reduce((sum, r) => sum + r.partySize, 0);

    const early = dayReservations
      .filter((r) => r.status !== 'cancelled' && r.time >= '17:00' && r.time < '18:30')
      .reduce((s, r) => s + r.partySize, 0);

    const prime = dayReservations
      .filter((r) => r.status !== 'cancelled' && r.time >= '18:30' && r.time < '20:30')
      .reduce((s, r) => s + r.partySize, 0);

    const late = dayReservations
      .filter((r) => r.status !== 'cancelled' && r.time >= '20:30')
      .reduce((s, r) => s + r.partySize, 0);

    const summary: CoverSummary = {
      date,
      totalReservations: dayReservations.filter((r) => r.status !== 'cancelled').length,
      totalCovers,
      maxDailyCapacity: ALL_SITTING_TIMES.length * db.maxSlotCovers,
      sittingCounts: { early, prime, late },
    };

    return res.json({ summary, reservations: db.reservations });
  });

  // 11. Update Reservation Status (Staff)
  app.patch('/api/admin/reservations/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    await acquireMutex();
    try {
      const db = loadDB();
      const resv = db.reservations.find((r) => r.id === id);
      if (!resv) {
        return res.status(404).json({ error: 'Reservation not found.' });
      }

      resv.status = status;
      saveDB(db);
      return res.json({ success: true, reservation: resv });
    } finally {
      releaseMutex();
    }
  });

  // Vite development vs production asset handling
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TALLOW server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
