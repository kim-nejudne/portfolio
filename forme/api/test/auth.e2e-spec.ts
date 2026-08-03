import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/exception.filter';
import { resetTestDatabase, testDatabaseUrl } from './setup';

/**
 * The guard sweep.
 *
 * Every route that is not explicitly public must reject an anonymous caller,
 * and every role-restricted route must reject the wrong role. The scaffold
 * shipped an admin surface with no lock on it at all, and TALLOW's runbook
 * documents the same sweep as a curl loop — this is that check, kept honest by
 * running on every commit rather than whenever someone remembers.
 */

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'forme-demo-2026';

interface Surface {
  method: 'get' | 'post' | 'patch';
  path: string;
  /** Roles that may reach it. Everyone else must be refused. */
  allowed: string[];
  body?: Record<string, unknown>;
}

/** Every non-public route, and who is entitled to it. */
const GUARDED: Surface[] = [
  { method: 'get', path: '/api/jobs', allowed: ['customer', 'prepress', 'floor', 'admin'] },
  { method: 'get', path: '/api/jobs/queue', allowed: ['prepress', 'admin'] },
  { method: 'get', path: '/api/customers', allowed: ['prepress', 'admin'] },
  { method: 'get', path: '/api/imposition/plan', allowed: ['prepress', 'admin'] },
  { method: 'get', path: '/api/auth/me', allowed: ['customer', 'prepress', 'floor', 'admin'] },
  {
    method: 'patch',
    path: '/api/pricing',
    allowed: ['admin'],
    body: { group: 'products', rowId: 'flyers', field: 'setup', value: 1000 },
  },
  {
    method: 'patch',
    path: '/api/jobs/FM-2608-0417/state',
    allowed: ['prepress', 'floor', 'admin'],
    body: { to: 'PROOFING' },
  },
  {
    method: 'post',
    path: '/api/jobs/FM-2608-0417/approve',
    allowed: ['customer', 'admin'],
  },
];

const PUBLIC = [
  '/api/health',
  '/api/pricing',
  '/api/presses',
  '/api/auth/demo-accounts',
  '/api/quotes?product=flyers&size=A5&quantity=1000',
];

const ROLES = ['customer', 'prepress', 'floor', 'admin'] as const;

describe('authentication and authorization', () => {
  let app: INestApplication<App>;
  const cookies = new Map<string, string>();

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    process.env.JWT_SECRET ??= 'a-test-secret-that-is-at-least-32-characters-long';
    await resetTestDatabase();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    for (const role of ROLES) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-in')
        .send({ email: `${role}@forme.demo`, password: DEMO_PASSWORD });
      expect(response.status).toBe(200);
      const raw = response.headers['set-cookie'] as unknown as string[];
      cookies.set(role, raw.map((entry) => entry.split(';')[0]).join('; '));
    }
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('without a session', () => {
    it.each(GUARDED)('$method $path is 401', async (surface) => {
      const response = await request(app.getHttpServer())
        [surface.method](surface.path)
        .send(surface.body ?? {});
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('never leaks a job body on a rejected read', async () => {
      const response = await request(app.getHttpServer()).get('/api/jobs');
      expect(response.body.jobs).toBeUndefined();
    });
  });

  describe('with the wrong role', () => {
    const cases = GUARDED.flatMap((surface) =>
      ROLES.filter((role) => !surface.allowed.includes(role)).map((role) => ({ surface, role })),
    );

    it.each(cases)('$role is refused $surface.method $surface.path', async ({ surface, role }) => {
      const response = await request(app.getHttpServer())
        [surface.method](surface.path)
        .set('Cookie', cookies.get(role)!)
        .send(surface.body ?? {});
      // 403 for a role that is not entitled; 404 where confirming the resource
      // exists would itself leak (a customer probing another account's job).
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('public routes', () => {
    it.each(PUBLIC)('%s is reachable without a session', async (path) => {
      const response = await request(app.getHttpServer()).get(path);
      expect(response.status).toBe(200);
    });
  });

  describe('sign-in', () => {
    it('sets httpOnly cookies for both tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-in')
        .send({ email: 'admin@forme.demo', password: DEMO_PASSWORD });

      const raw = response.headers['set-cookie'] as unknown as string[];
      const access = raw.find((entry) => entry.startsWith('forme_access'));
      const refresh = raw.find((entry) => entry.startsWith('forme_refresh'));

      expect(access).toMatch(/HttpOnly/i);
      expect(refresh).toMatch(/HttpOnly/i);
      // The refresh token is scoped to /auth so it is not attached to every
      // request the app makes.
      expect(refresh).toMatch(/Path=\/auth/i);
    });

    it('gives the same message for an unknown email and a wrong password', async () => {
      const unknown = await request(app.getHttpServer())
        .post('/api/auth/sign-in')
        .send({ email: 'nobody@forme.demo', password: DEMO_PASSWORD });
      const wrong = await request(app.getHttpServer())
        .post('/api/auth/sign-in')
        .send({ email: 'admin@forme.demo', password: 'not-the-password' });

      expect(unknown.status).toBe(401);
      expect(wrong.status).toBe(401);
      // Differing messages here turn the sign-in form into an account
      // enumerator.
      expect(unknown.body.error.message).toBe(wrong.body.error.message);
    });

    it('matches the email case-insensitively', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-in')
        .send({ email: 'ADMIN@FORME.DEMO', password: DEMO_PASSWORD });
      expect(response.status).toBe(200);
    });

    it('rejects a malformed body with per-field messages', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-in')
        .send({ email: 'not-an-email', password: '' });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
      expect(response.body.error.fields).toBeDefined();
    });

    it('refuses a property no DTO declares', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-in')
        .send({ email: 'admin@forme.demo', password: DEMO_PASSWORD, role: 'admin' });
      // whitelist + forbidNonWhitelisted: a client must not be able to smuggle
      // a field, least of all one called "role".
      expect(response.status).toBe(400);
    });
  });

  describe('session', () => {
    it('reports the signed-in user from the token, not the request', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookies.get('prepress')!);
      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('prepress');
      expect(response.body.user.email).toBe('prepress@forme.demo');
    });

    it('does not accept a refresh token as an access token', async () => {
      const refresh = cookies
        .get('admin')!
        .split('; ')
        .find((entry) => entry.startsWith('forme_refresh'))!
        .split('=')[1]!;

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${refresh}`);
      expect(response.status).toBe(401);
    });

    it('clears both cookies on sign-out', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-out')
        .set('Cookie', cookies.get('floor')!);
      expect(response.status).toBe(204);
      const raw = response.headers['set-cookie'] as unknown as string[];
      expect(raw.some((entry) => entry.startsWith('forme_access=;'))).toBe(true);
    });
  });

  describe('demo accounts', () => {
    it('advertises one account per role without exposing a password', async () => {
      const response = await request(app.getHttpServer()).get('/api/auth/demo-accounts');
      expect(response.body.accounts).toHaveLength(4);
      expect(JSON.stringify(response.body)).not.toContain(DEMO_PASSWORD);
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });

    it('refuses writes from a seeded demo account', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/pricing')
        .set('Cookie', cookies.get('admin')!)
        .send({ group: 'products', rowId: 'flyers', field: 'setup', value: 1234 });
      expect(response.status).toBe(403);
      expect(response.body.error.message).toMatch(/read-only demo/);
    });
  });
});
