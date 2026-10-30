import { join } from 'node:path';
import express, { type ErrorRequestHandler, type Express, type Response } from 'express';
import {
  CREATE_ROOM_BODY_MAX_BYTES,
  MAX_PLAYERS,
  ROOM_CHECK_RATE_LIMIT,
  ROOM_CREATE_RATE_LIMIT,
} from '../shared/constants.js';
import { createRoomBodySchema, roomCodeSchema } from '../shared/schemas.js';
import type {
  CreateRoomResponse,
  HealthResponse,
  HttpErrorBody,
  RoomExistsResponse,
} from '../shared/types.js';
import { createRoomCode, type Rng } from './codes.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { createRateLimiter } from './rateLimit.js';
import { createRoom } from './room.js';
import { InMemoryRoomStore, type RoomStore } from './roomStore.js';

export interface AppOptions {
  /** Built client (dist/client). When set, the app serves it, with index.html for client routes. */
  clientDir?: string;
  rooms?: RoomStore;
  /** Wall-clock ms for `createdAt` and the rate limiters. */
  clock?: () => number;
  /** Draws room codes. Seeded in tests. */
  rng?: Rng;
  /**
   * Express's `trust proxy` setting, so `req.ip` is the client's address behind a reverse proxy.
   * Off by default: trusting `X-Forwarded-For` without a proxy lets anyone dodge the rate limit.
   */
  trustProxy?: boolean | number | string;
}

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ ok: false, error } satisfies HttpErrorBody);
}

/** Body-parser failures (bad JSON, too large) as JSON errors instead of Express's HTML page. */
const apiErrors: ErrorRequestHandler = (
  err: { status?: unknown; type?: unknown },
  _req,
  res,
  next,
) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large') return sendError(res, 413, 'Request too large.');
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
    return sendError(res, err.status, 'Invalid request.');
  }
  console.error('HTTP error', err);
  sendError(res, 500, 'Something went wrong.');
};

export function createApp({
  clientDir,
  rooms = new InMemoryRoomStore(),
  clock = Date.now,
  rng = Math.random,
  trustProxy = false,
}: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  const createLimiter = createRateLimiter(ROOM_CREATE_RATE_LIMIT, clock);
  const checkLimiter = createRateLimiter(ROOM_CHECK_RATE_LIMIT, clock);

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true } satisfies HealthResponse);
  });

  // Every attempt counts against the limit, valid or not, so bad bodies cannot be used to probe for free.
  app.post(
    '/api/rooms',
    (req, res, next) => {
      if (createLimiter.hit(req.ip ?? 'unknown')) return next();
      sendError(res, 429, 'Too many games started from this network. Try again later.');
    },
    express.json({ limit: CREATE_ROOM_BODY_MAX_BYTES }),
    (req, res) => {
      // No body (or no JSON content type) leaves `req.body` undefined: that is `{}`.
      const parsed = createRoomBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) return sendError(res, 400, 'Invalid settings.');

      let code: string;
      try {
        code = createRoomCode((c) => rooms.has(c), rng);
      } catch {
        return sendError(res, 503, 'No room codes are free right now. Try again later.');
      }

      const hostToken = generateHostToken();
      rooms.set(
        createRoom({
          code,
          hostTokenHash: hashHostToken(hostToken),
          settings: parsed.data.settings,
          now: clock(),
        }),
      );
      res.status(201).json({ code, hostToken } satisfies CreateRoomResponse);
    },
  );

  // Limited so one address cannot walk the code space looking for live rooms.
  app.get('/api/rooms/:code/exists', (req, res) => {
    if (!checkLimiter.hit(req.ip ?? 'unknown')) {
      return sendError(res, 429, 'Too many tries. Wait a minute and try again.');
    }
    const code = roomCodeSchema.safeParse(req.params.code);
    const room = code.success ? rooms.get(code.data) : undefined;
    res.json({
      exists: room !== undefined,
      phase: room?.phase ?? null,
      full: room !== undefined && Object.keys(room.players).length >= MAX_PLAYERS,
    } satisfies RoomExistsResponse);
  });

  app.use('/api', (_req, res) => sendError(res, 404, 'Not found.'));
  app.use('/api', apiErrors);

  if (clientDir) {
    app.use(express.static(clientDir));
    // Client routes (/play/:code, /screen/:code, …) load the SPA; /api and /socket.io never fall through to it.
    app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
      res.sendFile(join(clientDir, 'index.html'));
    });
  }

  return app;
}
