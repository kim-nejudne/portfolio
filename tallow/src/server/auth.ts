import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Two roles, because the deployed site is a public portfolio piece:
 *
 *   staff — full access. PIN is private (STAFF_PIN).
 *   demo  — may read the dashboard, may not change anything. PIN is printed on
 *           the sign-in screen so a visitor can explore the 86 board.
 *
 * Sessions are HMAC-signed rather than stored, so a container restart does not
 * sign anyone out and there is no session table to grow unbounded.
 */
export type Role = 'staff' | 'demo';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours — one service, generously

/** Validates auth configuration at boot so failures are loud and immediate. */
export function assertAuthConfig() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'SESSION_SECRET must be set to at least 32 characters — admin sessions cannot be signed without it.'
    );
  }
  if (!process.env.STAFF_PIN) {
    throw new Error('STAFF_PIN must be set — there would be no way to administer the app.');
  }
  if (process.env.DEMO_PIN && process.env.DEMO_PIN === process.env.STAFF_PIN) {
    throw new Error('DEMO_PIN must differ from STAFF_PIN, or the read-only role grants full access.');
  }
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set to at least 32 characters.');
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Constant-time string compare that does not leak length via early return. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still burn a comparison so the timing profile matches the equal-length path.
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

export function mintToken(role: Role): string {
  const payload = Buffer.from(
    JSON.stringify({ role, exp: Date.now() + SESSION_TTL_MS })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): Role | null {
  if (!token) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return null;
  if (!safeEqual(mac, sign(payload))) return null;

  try {
    const { role, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof exp !== 'number' || Date.now() > exp) return null;
    if (role !== 'staff' && role !== 'demo') return null;
    return role;
  } catch {
    return null;
  }
}

/** Resolves a submitted PIN to a role, or null. Demo PIN is optional. */
export function roleForPin(pin: unknown): Role | null {
  if (typeof pin !== 'string' || !pin) return null;
  const staffPin = process.env.STAFF_PIN;
  const demoPin = process.env.DEMO_PIN;
  if (staffPin && safeEqual(pin.trim().toLowerCase(), staffPin.toLowerCase())) return 'staff';
  if (demoPin && safeEqual(pin.trim().toLowerCase(), demoPin.toLowerCase())) return 'demo';
  return null;
}

function bearer(req: Request): string | undefined {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

/** Any valid session — used for reading the dashboard. */
export function requireSession(req: Request, res: Response, next: NextFunction) {
  const role = verifyToken(bearer(req));
  if (!role) {
    return res.status(401).json({ error: 'Staff sign-in required.' });
  }
  (req as Request & { role?: Role }).role = role;
  next();
}

/** A staff session — used for anything that mutates state. */
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const role = verifyToken(bearer(req));
  if (!role) {
    return res.status(401).json({ error: 'Staff sign-in required.' });
  }
  if (role !== 'staff') {
    return res.status(403).json({
      error: 'This is a read-only demo session. Changes are disabled on the public preview.',
      readOnly: true,
    });
  }
  (req as Request & { role?: Role }).role = role;
  next();
}

/**
 * Fixed-window limiter on sign-in attempts, keyed by client IP. The PINs are
 * short and the site is public, so unlimited guessing should not be on offer.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function rateLimitAuth(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip ?? 'unknown';

  // Opportunistic sweep — the map only ever holds recent, active windows.
  if (attempts.size > 1000) {
    for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
  }

  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many sign-in attempts. Try again shortly.' });
  }
  next();
}

/** Clears the limiter for a client after a correct PIN. */
export function clearRateLimit(req: Request) {
  attempts.delete(req.ip ?? 'unknown');
}
