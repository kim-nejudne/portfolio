import { networkInterfaces } from 'node:os';
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
  ADMIN_LOGIN_RATE_LIMIT,
  CREATE_ROOM_BODY_MAX_BYTES,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  PAIR_INVALID_PIN_ERROR,
  PAIR_RATE_LIMIT,
  PAIR_RATE_LIMITED_ERROR,
  ROOM_CHECK_RATE_LIMIT,
  ROOM_CHECK_RATE_LIMITED_ERROR,
  ROOM_CREATE_RATE_LIMIT,
  ROOM_NOT_FOUND_ERROR,
} from '../shared/constants.js';
import {
  createRoomBodySchema,
  idSchema,
  newGameBodySchema,
  pairBodySchema,
  roomCodeSchema,
} from '../shared/schemas.js';
import type {
  BuiltInSetsResponse,
  ConfigResponse,
  CreateRoomResponse,
  HttpErrorBody,
  NewGameResponse,
  PairingResponse,
  PairResponse,
  RoomExistsResponse,
  UploadImageResponse,
} from '../shared/types.js';
import { AdminSessions } from './admin.js';
import { adminRoutes } from './adminRoutes.js';
import type { BuiltInStore } from './builtInStore.js';
import { createRoomCode, type Rng } from './codes.js';
import { lanAddress, type AdminPasswordHash } from './env.js';
import { generateHostToken, hashHostToken, verifyHostToken } from './hostToken.js';
import { InMemoryImageStore, type ImageStore } from './imageStore.js';
import { PairingStore } from './pairing.js';
import { createRateLimiter } from './rateLimit.js';
import { reduce, WRONG_PHASE_ERROR } from './reducer.js';
import { createRoom } from './room.js';
import { InMemoryRoomStore, type RoomStore } from './roomStore.js';
import type { Dispatch } from './sockets.js';

export interface AppOptions {
  /** Built client (dist/client). When set, the app serves it, with index.html for client routes. */
  clientDir?: string;
  rooms?: RoomStore;
  /** Uploaded question images. Share it with the room sweeper so a deleted room frees its images. */
  images?: ImageStore;
  /** Live pairing PINs (F70). Tests pass one with a fixed PIN. */
  pairings?: PairingStore;
  /** Wall-clock ms for `createdAt` and the rate limiter. */
  clock?: () => number;
  /** Draws room codes. Seeded in tests. */
  rng?: Rng;
  /**
   * Express's `trust proxy` setting, so `req.ip` is the client's address behind a reverse proxy.
   * Off by default: trusting `X-Forwarded-For` without a proxy lets anyone dodge the rate limit.
   */
  trustProxy?: boolean | number | string;
  /** `PUBLIC_URL`, already parsed to an origin. When set, it is always the join origin. */
  publicUrl?: string | null;
  /** The server's network interfaces, read on each config request. Faked in tests. */
  interfaces?: () => ReturnType<typeof networkInterfaces>;
  /**
   * The gateway's `dispatch`, so an HTTP action reaches every device. Without a gateway (HTTP-only
   * tests) the action is reduced and stored, and nobody is told.
   */
  dispatch?: Dispatch;
  /** The built-in sets file (F103). Without it, `GET /api/built-in-sets` is not served. */
  builtIns?: BuiltInStore;
  /** `ADMIN_PASSWORD_HASH`, parsed (F105). Null or absent, every `/api/admin` route is 404. */
  adminPassword?: AdminPasswordHash | null;
  /** Signed-in admin sessions. Tests pass one with a short life. */
  adminSessions?: AdminSessions;
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

/** True when the page was opened at an address only this computer can reach (client `isLoopbackHost`). */
function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(hostname);
}

export function createApp({
  clientDir,
  rooms = new InMemoryRoomStore(),
  images = new InMemoryImageStore(),
  pairings = new PairingStore(),
  clock = Date.now,
  rng = Math.random,
  trustProxy = false,
  publicUrl = null,
  interfaces = networkInterfaces,
  dispatch = (code, action) => {
    const room = rooms.get(code);
    const result = room
      ? reduce(room, action, clock())
      : { ok: false as const, error: ROOM_NOT_FOUND_ERROR };
    if (result.ok) rooms.set(result.room);
    return result.ok ? { ok: true } : result;
  },
  builtIns,
  adminPassword = null,
  adminSessions = new AdminSessions(),
}: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  const createLimiter = createRateLimiter(ROOM_CREATE_RATE_LIMIT, clock);
  const checkLimiter = createRateLimiter(ROOM_CHECK_RATE_LIMIT, clock);
  const pairIpLimiter = createRateLimiter(PAIR_RATE_LIMIT, clock);
  const pairRoomLimiter = createRateLimiter(PAIR_RATE_LIMIT, clock);
  const adminLoginLimiter = createRateLimiter(ADMIN_LOGIN_RATE_LIMIT, clock);

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  // Where phones should join. A Screen on localhost cannot hand out its own origin, so without
  // PUBLIC_URL it gets this machine's LAN address; the client adds its page's port (DECISIONS F42).
  app.get('/api/config', (req, res) => {
    let joinOrigin = publicUrl;
    if (joinOrigin === null && isLoopbackHostname(req.hostname)) {
      const address = lanAddress(interfaces());
      joinOrigin = address === null ? null : `http://${address}`;
    }
    res.json({ joinOrigin } satisfies ConfigResponse);
  });

  // The live built-ins for the Built-in tab and the pickers. Drafts stay admin-only. An admin
  // change shows on the next fetch, so caches must revalidate.
  if (builtIns) {
    app.get('/api/built-in-sets', (_req, res) => {
      const { sets, sampleHidden } = builtIns.read();
      res.set('Cache-Control', 'no-cache');
      res.json({ sets, sampleHidden } satisfies BuiltInSetsResponse);
    });
  }

  app.use(
    '/api/admin',
    adminPassword === null
      ? (_req, res) => sendError(res, 404, 'Not found.')
      : adminRoutes(adminPassword, adminSessions, adminLoginLimiter, clock),
  );

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

  // Limited so one address cannot walk the code space looking for live rooms.
  app.get('/api/rooms/:code/exists', (req, res) => {
    if (!checkLimiter.hit(req.ip ?? 'unknown')) {
      return sendError(res, 429, ROOM_CHECK_RATE_LIMITED_ERROR);
    }
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

  // A new game in the same room (DECISIONS F49). The room and token are checked before the body is
  // read, so only the host can make the server buffer a set.
  app.put(
    '/api/rooms/:code/set',
    (req, res, next) => {
      const code = roomCodeSchema.safeParse(req.params.code);
      const room = code.success ? rooms.get(code.data) : undefined;
      if (!room) return sendError(res, 404, 'This room does not exist.');
      const token = bearerToken(req);
      if (token === undefined || !verifyHostToken(token, room.hostTokenHash)) {
        res.set('WWW-Authenticate', 'Bearer');
        return sendError(res, 401, 'Only the host of this room can start a new game.');
      }
      res.locals.code = room.code;
      next();
    },
    express.json({ limit: CREATE_ROOM_BODY_MAX_BYTES }),
    (req, res) => {
      const parsed = newGameBodySchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, 400, `Invalid set: ${z.prettifyError(parsed.error)}`);
        return;
      }
      const code = res.locals.code as string;
      const { set, keepScores } = parsed.data;
      const ack = dispatch(code, { type: 'host:newGame', set, keepScores });
      if (!ack.ok) {
        // Only FINAL takes a new game: a second request (Screen and remote racing) lands here.
        if (ack.error === WRONG_PHASE_ERROR) {
          return sendError(res, 409, 'A new game can start only after the game has ended.');
        }
        // The room expired between the check above and now.
        if (ack.error === ROOM_NOT_FOUND_ERROR) {
          return sendError(res, 404, 'This room does not exist.');
        }
        return sendError(res, 409, ack.error);
      }
      // The old set's images go; the upload route now accepts only the new set's imageIds.
      images.deleteRoom(code);
      res.json({ ok: true } satisfies NewGameResponse);
    },
  );

  // A pairing PIN for a phone that cannot scan the QR (F70). Only a host can ask; a new PIN replaces
  // the room's previous one.
  app.post('/api/rooms/:code/pairing', (req, res) => {
    const code = roomCodeSchema.safeParse(req.params.code);
    const room = code.success ? rooms.get(code.data) : undefined;
    if (!room) return sendError(res, 404, 'This room does not exist.');
    const token = bearerToken(req);
    if (token === undefined || !verifyHostToken(token, room.hostTokenHash)) {
      res.set('WWW-Authenticate', 'Bearer');
      return sendError(res, 401, 'Only the host of this room can pair a phone.');
    }
    // SPEC-QUESTION: the room stores only the token's hash, so the PIN keeps the presented token
    // in memory for its 60 s to hand back on a match (DECISIONS F70).
    const pin = pairings.create(room.code, token, clock());
    res.status(201).json({ pin } satisfies PairingResponse);
  });

  // Every attempt counts against both limits, valid or not. The IP is checked first, so one address
  // past its limit cannot use up the room's tries as well.
  const limitPair: RequestHandler = (req, res, next) => {
    const room = String(req.params.code).toUpperCase();
    if (pairIpLimiter.hit(req.ip ?? 'unknown') && pairRoomLimiter.hit(room)) return next();
    sendError(res, 429, PAIR_RATE_LIMITED_ERROR);
  };

  const redeemPin: RequestHandler = (req, res) => {
    const parsed = pairBodySchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, 'Send the 6-digit PIN.');
    const code = roomCodeSchema.safeParse(req.params.code);
    const result =
      code.success && rooms.has(code.data)
        ? pairings.redeem(code.data, parsed.data.pin, clock())
        : { ok: false as const };
    if (!result.ok) return sendError(res, 401, PAIR_INVALID_PIN_ERROR);
    res.json({ hostToken: result.hostToken } satisfies PairResponse);
  };

  const onPairTooLarge: ErrorRequestHandler = (err: { type?: string }, _req, res, next) => {
    if (err.type !== 'entity.too.large') return next(err);
    sendError(res, 413, 'Send only the 6-digit PIN.');
  };

  app.post(
    '/api/rooms/:code/pair',
    limitPair,
    express.json({ limit: 1024 }),
    redeemPin,
    onPairTooLarge,
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
