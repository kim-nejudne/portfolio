import express, { type ErrorRequestHandler, type Express, type Response } from 'express';
import { MAX_PLAYERS, RATE_LIMITS } from '#shared/constants.js';
import { roomCodeSchema } from '#shared/schemas.js';
import type { Phase } from '#shared/types.js';
import { createRoomCode, type Rng } from './codes.js';
import type { Env } from './env.js';
import { createRateLimiter, type RateLimiter } from './rateLimit.js';
import { createRoom, RoomStore } from './roomStore.js';

export interface AppOptions {
  /** Built client (dist/client). When set, the app serves it, with index.html for client routes. */
  clientDir?: string;
  /** Express's `trust proxy` value (`TRUST_PROXY`): `req.ip`, the key of every limit, follows it. */
  trustProxy?: Env['trustProxy'];
  rooms?: RoomStore;
  clock?: () => number;
  rng?: Rng;
  /**
   * The 30-per-minute-per-IP limit shared by `GET /api/rooms/:code/exists`, `GET /api/credits/:code`
   * and `screen:join`; pass the same limiter to the socket gateway.
   */
  roomLookupLimiter?: RateLimiter;
  /** One line per request (key= redacted). */
  log?: (line: string) => void;
}

export interface RoomExistsResponse {
  exists: boolean;
  phase: Phase | null;
  full: boolean;
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
  clock = Date.now,
  rng = Math.random,
  roomLookupLimiter = createRateLimiter(RATE_LIMITS.roomLookup, clock),
  log = console.log,
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
    } satisfies RoomExistsResponse);
  });

  // An unknown API path stays a JSON 404; it never falls through to the client.
  app.use('/api', (_req, res) => {
    sendError(res, 404, 'Not found.');
  });

  if (clientDir) {
    app.use(express.static(clientDir, { index: false }));
    // Client routes (/play/:code, /screen/:code, /admin…) load the SPA; /api, /socket.io and
    // /tiles never fall through to it.
    app.get(/^\/(?!api\/|socket\.io\/|tiles\/).*/, (_req, res) => {
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
