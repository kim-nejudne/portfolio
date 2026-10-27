import { join } from 'node:path';
import express, { type ErrorRequestHandler, type Express, type Response } from 'express';
import { z } from 'zod';
import { CREATE_ROOM_BODY_MAX_BYTES, ROOM_CREATE_RATE_LIMIT } from '../shared/constants.js';
import { createRoomBodySchema, roomCodeSchema } from '../shared/schemas.js';
import type { CreateRoomResponse, HttpErrorBody, RoomExistsResponse } from '../shared/types.js';
import { createRoomCode, type Rng } from './codes.js';
import { generateHostToken, hashHostToken } from './hostToken.js';
import { createRateLimiter } from './rateLimit.js';
import { createRoom } from './room.js';
import { InMemoryRoomStore, type RoomStore } from './roomStore.js';

export interface AppOptions {
  /** Built client (dist/client). When set, the app serves it, with index.html for client routes. */
  clientDir?: string;
  rooms?: RoomStore;
  /** Wall-clock ms for `createdAt` and the rate limiter. */
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

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  // Every attempt counts against the limit, valid or not, so bad bodies cannot be used to probe for free.
  app.post(
    '/api/rooms',
    (req, res, next) => {
      if (createLimiter.hit(req.ip ?? 'unknown')) return next();
      sendError(res, 429, 'Too many rooms created from this network. Try again later.');
    },
    express.json({ limit: CREATE_ROOM_BODY_MAX_BYTES }),
    (req, res) => {
      const parsed = createRoomBodySchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, 400, `Invalid room: ${z.prettifyError(parsed.error)}`);
        return;
      }

      let code: string;
      try {
        code = createRoomCode((c) => rooms.has(c), rng);
      } catch {
        sendError(res, 503, 'No room codes are free right now. Try again later.');
        return;
      }

      const hostToken = generateHostToken();
      rooms.set(
        createRoom({
          code,
          hostTokenHash: hashHostToken(hostToken),
          set: parsed.data.set,
          settings: parsed.data.settings,
          now: clock(),
        }),
      );
      res.status(201).json({ code, hostToken } satisfies CreateRoomResponse);
    },
  );

  app.get('/api/rooms/:code/exists', (req, res) => {
    const code = roomCodeSchema.safeParse(req.params.code);
    const room = code.success ? rooms.get(code.data) : undefined;
    res.json({
      exists: room !== undefined,
      phase: room?.phase ?? null,
    } satisfies RoomExistsResponse);
  });

  if (clientDir) {
    app.use(express.static(clientDir));
    // Client routes (/play/:code, /screen/:code, …) load the SPA; /api and /socket.io never fall through to it.
    app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
      res.sendFile(join(clientDir, 'index.html'));
    });
  }

  // Body-parser failures (malformed JSON, too large) answer in the same shape as other errors.
  const onError: ErrorRequestHandler = (
    err: { status?: number; type?: string },
    _req,
    res,
    next,
  ) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.too.large')
      return sendError(res, 413, 'The question set is too large.');
    if (err.type === 'entity.parse.failed')
      return sendError(res, 400, 'The request body is not valid JSON.');
    console.error(err);
    sendError(res, 500, 'Something went wrong on the server.');
  };
  app.use(onError);

  return app;
}
