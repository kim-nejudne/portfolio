// scripts/smoke.sh against the in-process app, with a stand-in client build and one real PNG tile.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type AppOptions } from '../server/http.js';
import { adminPasswordFor } from '../server/test/admin.js';

const KEY = 'smoke-secret-carto-key';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

let server: Server | undefined;
let dir: string | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

async function start(options: AppOptions = {}): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), 'pinpoint-smoke-'));
  const clientDir = join(dir, 'client');
  const tilesDir = join(dir, 'tiles');
  await mkdir(clientDir);
  await mkdir(join(tilesDir, '0', '0'), { recursive: true });
  await writeFile(join(clientDir, 'index.html'), '<body><div id="root"></div></body>');
  await writeFile(join(tilesDir, '0', '0', '0.png'), PNG);
  server = createApp({ log: () => {}, clientDir, fallbackTilesDir: tilesDir, ...options }).listen(
    0,
  );
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function smoke(base: string, env: Record<string, string> = {}) {
  return new Promise<{ code: number; out: string }>((resolve) => {
    execFile(
      'bash',
      ['scripts/smoke.sh', base],
      { env: { PATH: process.env.PATH, ...env } },
      (err, stdout, stderr) => resolve({ code: err ? Number(err.code) : 0, out: stdout + stderr }),
    );
  });
}

describe('scripts/smoke.sh', () => {
  it('passes with the fallback only', async () => {
    const { code, out } = await smoke(await start());
    expect(out).toContain('ok   /api/config: fallback template, CARTO tiles null');
    expect(out).toMatch(/ok {3}POST \/api\/rooms 201 \(room [A-Z]{4}\), and it exists/);
    expect(out).toContain('ok   /tiles/fallback/0/0/0.png is a PNG');
    expect(out).toContain('ok   /api/admin/session 404');
    expect(out.trim().endsWith('PASS')).toBe(true);
    expect(code).toBe(0);
  });

  it('with SMOKE_EXPECT_TILES=1 passes when CARTO is set, never printing the URL', async () => {
    const { code, out } = await smoke(await start({ cartoKey: KEY }), { SMOKE_EXPECT_TILES: '1' });
    expect(out).toContain('ok   /api/config: fallback template, CARTO tiles set');
    expect(code).toBe(0);
    expect(out).not.toContain(KEY);
    expect(out).not.toContain('cartocdn');
  });

  it('with SMOKE_EXPECT_TILES=1 fails when the tiles are null', async () => {
    const { code, out } = await smoke(await start(), { SMOKE_EXPECT_TILES: '1' });
    expect(out).toContain('FAIL: /api/config tiles is null, expected a CARTO template');
    expect(code).toBe(1);
  });

  it('expects 401 from the admin with SMOKE_EXPECT_ADMIN=1, and fails on 404', async () => {
    const walled = await smoke(await start({ adminPassword: adminPasswordFor('pw') }), {
      SMOKE_EXPECT_ADMIN: '1',
    });
    expect(walled.out).toContain('ok   /api/admin/session 401');
    expect(walled.code).toBe(0);
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
    const open = await smoke(await start(), { SMOKE_EXPECT_ADMIN: '1' });
    expect(open.out).toContain('FAIL: /api/admin/session answered 404, expected 401');
    expect(open.code).toBe(1);
  });

  it('fails when / does not serve the app shell', async () => {
    const { code, out } = await smoke(await start({ clientDir: undefined }));
    expect(out).toContain('FAIL: / did not serve the app shell');
    expect(code).toBe(1);
  });
});
