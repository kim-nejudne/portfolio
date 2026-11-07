import express, { type ErrorRequestHandler, type Express, type Response } from 'express';
import { z } from 'zod';
import { DEFAULT_BOT_COUNT, MAX_PLAYERS, RATE_LIMITS } from '#shared/constants.js';
import { roomCodeSchema } from '#shared/schemas.js';
import type { CategorySummary, ConfigResponse, RoomExistsResponse } from '#shared/types.js';
import { AdminSessions, adminRoutes } from './admin.js';
import { CategoryStore } from './categoryStore.js';
import { createRoomCode, type Rng } from './codes.js';
import {
  GENERATE_DAILY_LIMIT_DEFAULT,
  GENERATE_REPLACE_DAILY_LIMIT_DEFAULT,
  type AdminPasswordHash,
  type Env,
} from './env.js';
import { FALLBACK_TILES_DIR, fallbackTileFile, tileConfig, WATER_TILE } from './fallbackTiles.js';
import { GENERATION_OFF_NO_KEY } from './generate/fake.js';
import { createJobRunner, type JobRunner } from './generate/jobs.js';
import { WikimediaError, type WikimediaClient } from './generate/wikimedia.js';
import { createRateLimiter, type RateLimiter } from './rateLimit.js';
import { createRoom, RoomStore } from './roomStore.js';

export interface AppOptions {
  /** Built client (dist/client). When set, the app serves it, with index.html for client routes. */
  clientDir?: string;
  /** Express's `trust proxy` value (`TRUST_PROXY`): `req.ip`, the key of every limit, follows it. */
  trustProxy?: Env['trustProxy'];
  rooms?: RoomStore;
  /** Live categories for the lobby; empty when omitted. */
  categories?: CategoryStore;
  clock?: () => number;
  rng?: Rng;
  /**
   * The 30-per-minute-per-IP limit shared by `GET /api/rooms/:code/exists`, `GET /api/credits/:code`
   * and `screen:join`; pass the same limiter to the socket gateway.
   */
  roomLookupLimiter?: RateLimiter;
  /** `PINPOINT_CARTO_KEY`: fills the CARTO tile URL in `GET /api/config`. */
  cartoKey?: string | null;
  /** Rendered fallback tiles (`npm run tiles:fallback`). */
  fallbackTilesDir?: string;
  /** One line per request (key= redacted). */
  log?: (line: string) => void;
  /** Mounts `/dev/*` (spec: Dev tools); only outside production. */
  devTools?: boolean;
  /** `ADMIN_PASSWORD_HASH`, parsed. Null or absent, every `/api/admin` route is 404. */
  adminPassword?: AdminPasswordHash | null;
  /** Signed-in admin sessions. Tests pass one with a short life. */
  adminSessions?: AdminSessions;
  /** The shared Wikimedia client for Add by name; tests pass the fake. Absent, those routes answer 502. */
  wikimedia?: () => WikimediaClient;
  /** Generation jobs; absent, generation is off (no key) and every start answers 503. */
  jobs?: JobRunner;
}

// SPEC-QUESTION: DECISIONS 13 (the spec names only img-src and connect-src; the rest is locked down)
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://*.basemaps.cartocdn.com https://upload.wikimedia.org data:",
  "connect-src 'self'",
  "font-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Replaces the value of every `key=` query parameter, so a key never reaches a log line. */
export function redactKeys(url: string): string {
  return url.replace(/([?&]key=)[^&#]*/gi, '$1[redacted]');
}

const LOOKUP_LIMITED_ERROR = 'Too many tries. Wait a minute and try again.';

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ error });
}

export function createApp({
  clientDir,
  trustProxy = false,
  rooms = new RoomStore(),
  categories = new CategoryStore([]),
  clock = Date.now,
  rng = Math.random,
  roomLookupLimiter = createRateLimiter(RATE_LIMITS.roomLookup, clock),
  cartoKey = null,
  fallbackTilesDir = FALLBACK_TILES_DIR,
  log = console.log,
  devTools = false,
  adminPassword = null,
  adminSessions = new AdminSessions(),
  wikimedia = () => {
    throw new WikimediaError('Wikimedia is not set up on this server');
  },
  jobs = createJobRunner({
    level: null,
    off: GENERATION_OFF_NO_KEY,
    store: categories,
    clock,
    dailyLimit: GENERATE_DAILY_LIMIT_DEFAULT,
    replaceDailyLimit: GENERATE_REPLACE_DAILY_LIMIT_DEFAULT,
  }),
}: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  const createLimiter = createRateLimiter(RATE_LIMITS.roomCreate, clock);

  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.path !== '/healthz') {
      const started = performance.now();
      res.on('finish', () => {
        const ms = Math.round(performance.now() - started);
        log(`${req.method} ${redactKeys(req.originalUrl)} ${res.statusCode} ${ms}ms`);
      });
    }
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/rooms', (req, res) => {
    if (!createLimiter.hit(req.ip ?? 'unknown')) {
      return sendError(res, 429, 'Too many games created from this network. Try again later.');
    }
    let code: string;
    try {
      code = createRoomCode((c) => rooms.has(c), rng);
    } catch {
      return sendError(res, 503, 'No room codes are free right now. Try again later.');
    }
    rooms.set(createRoom(code, clock(), Math.floor(rng() * 2 ** 32)));
    res.status(201).json({ code });
  });

  // Limited so one address cannot walk the code space looking for live rooms.
  app.get('/api/rooms/:code/exists', (req, res) => {
    if (!roomLookupLimiter.hit(req.ip ?? 'unknown')) {
      return sendError(res, 429, LOOKUP_LIMITED_ERROR);
    }
    const code = roomCodeSchema.safeParse(req.params.code);
    const room = code.success ? rooms.get(code.data) : undefined;
    res.json({
      exists: room !== undefined,
      phase: room?.phase ?? null,
      full: room !== undefined && Object.keys(room.players).length >= MAX_PLAYERS,
      // SPEC-QUESTION: DECISIONS 18 (the spec lists {exists, phase, full}; the form needs the taken emoji)
      takenEmoji: room ? Object.values(room.players).map((p) => p.emoji) : [],
    } satisfies RoomExistsResponse);
  });

  app.get('/api/categories', (_req, res) => {
    res.json(categories.summaries() satisfies CategorySummary[]);
  });

  app.get('/api/config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store'); // the body carries the CARTO key: no shared caches
    res.json(tileConfig(cartoKey) satisfies ConfigResponse);
  });

  const tileOptions = { root: fallbackTilesDir, maxAge: '30d', immutable: true };
  app.get('/tiles/fallback/:z/:x/:y.png', (req, res, next) => {
    const file = fallbackTileFile(req.params.z, req.params.x, req.params.y);
    if (!file) return sendError(res, 404, 'Not found.');
    // Only land tiles are on disk; every other address is open sea.
    res.sendFile(file, tileOptions, (err?: Error & { status?: number }) => {
      if (!err || res.headersSent) return;
      if (err.status !== 404) return next(err); // a read failure is an error, not open sea
      res.sendFile(WATER_TILE, tileOptions, (waterErr?: Error & { status?: number }) => {
        if (!waterErr || res.headersSent) return;
        if (waterErr.status !== 404) return next(waterErr);
        sendError(res, 404, 'Not found.');
      });
    });
  });

  if (devTools) {
    // Fake players: GET /dev/bots/ABCD?count=4 joins them to the room (spec: Dev tools).
    // SPEC-QUESTION: DECISIONS 34 (GET, ?count= default and cap, names, no auth outside production)
    app.get('/dev/bots/:code', async (req, res) => {
      const code = roomCodeSchema.safeParse(req.params.code);
      const room = code.success ? rooms.get(code.data) : undefined;
      if (!room) return sendError(res, 404, 'No such room.');
      const count = z.coerce
        .number()
        .int()
        .min(1)
        .max(MAX_PLAYERS)
        .catch(DEFAULT_BOT_COUNT)
        .parse(req.query.count ?? DEFAULT_BOT_COUNT);
      const { botIdentities, spawnBots } = await import('./devBots.js');
      const bots = await spawnBots({
        url: `http://127.0.0.1:${req.socket.localPort}`,
        code: room.code,
        identities: botIdentities(room, count),
      });
      if (bots.names.length === 0) {
        return sendError(res, 409, 'No bot could join: the room is full or the game has ended.');
      }
      res.json({ code: room.code, bots: bots.names });
    });
  }

  if (adminPassword !== null) {
    const admin = adminRoutes({
      password: adminPassword,
      sessions: adminSessions,
      loginLimiter: createRateLimiter(RATE_LIMITS.adminLogin, clock),
      clock,
      categories,
      wikimedia,
      jobs,
    });
    app.use('/api/admin', admin.router);
  }

  // An unknown API or dev path stays a JSON 404; it never falls through to the client.
  app.use('/dev', (_req, res) => {
    sendError(res, 404, 'Not found.');
  });
  app.use('/api', (_req, res) => {
    sendError(res, 404, 'Not found.');
  });

  if (clientDir) {
    app.use(express.static(clientDir, { index: false }));
    // Client routes (/play/:code, /screen/:code, /admin…) load the SPA; /api, /dev, /socket.io
    // and /tiles never fall through to it.
    app.get(/^\/(?!api\/|dev\/|socket\.io\/|tiles\/).*/, (_req, res) => {
      res.sendFile('index.html', { root: clientDir }); // root: a dot dir above it (~/.cache) is fine
    });
  }

  // Express's default handler would print the stack; this logs only the redacted URL and message.
  const onError: ErrorRequestHandler = (
    err: { status?: number; message?: string },
    req,
    res,
    next,
  ) => {
    log(`ERROR ${req.method} ${redactKeys(req.originalUrl)}: ${err.message ?? 'unknown'}`);
    if (res.headersSent) return next(err);
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    sendError(res, status, status === 500 ? 'Something went wrong.' : 'Not found.');
  };
  app.use(onError);

  return app;
}
