import { join } from 'node:path';
import express, {
  type ErrorRequestHandler,
  type Express,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { z } from 'zod';
import {
  CREATE_ROOM_BODY_MAX_BYTES,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  ROOM_CREATE_RATE_LIMIT,
} from '../shared/constants.js';
import { createRoomBodySchema, idSchema, roomCodeSchema } from '../shared/schemas.js';
import type {
  CreateRoomResponse,
  HttpErrorBody,
  RoomExistsResponse,
  UploadImageResponse,
} from '../shared/types.js';
import { createRoomCode, type Rng } from './codes.js';
import { generateHostToken, hashHostToken, verifyHostToken } from './hostToken.js';
import { InMemoryImageStore, type ImageStore } from './imageStore.js';
import { createRateLimiter } from './rateLimit.js';
import { createRoom } from './room.js';
import { InMemoryRoomStore, type RoomStore } from './roomStore.js';

export interface AppOptions {
  /** Built client (dist/client). When set, the app serves it, with index.html for client routes. */
  clientDir?: string;
  rooms?: RoomStore;
  /** Uploaded question images. Share it with the room sweeper so a deleted room frees its images. */
  images?: ImageStore;
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

/** Images are only ever replaced by a re-upload of the same bytes, so a URL can be cached for good. */
const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** The token from `Authorization: Bearer <token>`, or undefined. */
function bearerToken(req: Request): string | undefined {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
  return match?.[1];
}

export function createApp({
  clientDir,
  rooms = new InMemoryRoomStore(),
  images = new InMemoryImageStore(),
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

  // Checks the room, the token and the image id before the body is read, so a stranger cannot make
  // the server buffer 1.5 MB, and only images the room's questions use can be stored.
  const checkImageUpload: RequestHandler = (req, res, next) => {
    const code = roomCodeSchema.safeParse(req.params.code);
    const imageId = idSchema.safeParse(req.params.imageId);
    const room = code.success ? rooms.get(code.data) : undefined;
    if (!room || !imageId.success) return sendError(res, 404, 'This room does not exist.');
    const token = bearerToken(req);
    if (token === undefined || !verifyHostToken(token, room.hostTokenHash)) {
      res.set('WWW-Authenticate', 'Bearer');
      return sendError(res, 401, 'Only the host of this room can upload images.');
    }
    if (!room.set.questions.some((q) => q.imageId === imageId.data)) {
      return sendError(res, 404, 'No question in this room uses that image.');
    }
    if (!(IMAGE_TYPES as readonly string[]).includes(req.get('content-type') ?? '')) {
      return sendError(res, 415, 'Upload a PNG, JPEG, WebP or GIF image.');
    }
    res.locals.code = code.data;
    res.locals.imageId = imageId.data;
    next();
  };

  const onImageTooLarge: ErrorRequestHandler = (err: { type?: string }, _req, res, next) => {
    if (err.type !== 'entity.too.large') return next(err);
    sendError(res, 413, 'The image is larger than 1.5 MB.');
  };

  const storeImage: RequestHandler = (req, res) => {
    const data = req.body as unknown;
    if (!Buffer.isBuffer(data) || data.length === 0) {
      return sendError(res, 400, 'The image is empty.');
    }
    const result = images.put(res.locals.code as string, res.locals.imageId as string, {
      type: req.get('content-type')!,
      data,
    });
    if (result === 'room-full') {
      return sendError(res, 413, "This game's images are over 50 MB in total.");
    }
    if (result === 'server-full') {
      return sendError(res, 507, 'The server is out of room for images. Try again later.');
    }
    res.status(201).json({ ok: true } satisfies UploadImageResponse);
  };

  app.post(
    '/api/rooms/:code/images/:imageId',
    checkImageUpload,
    express.raw({ type: () => true, limit: IMAGE_MAX_BYTES }),
    storeImage,
    onImageTooLarge,
  );

  app.get('/api/rooms/:code/images/:imageId', (req, res) => {
    const code = roomCodeSchema.safeParse(req.params.code);
    const image =
      code.success && rooms.has(code.data) ? images.get(code.data, req.params.imageId) : undefined;
    if (!image) return sendError(res, 404, 'No such image.');
    res.set({
      'Content-Type': image.type,
      'Cache-Control': IMAGE_CACHE_CONTROL,
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(image.data);
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
