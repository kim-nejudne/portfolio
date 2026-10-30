import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type AppOptions } from './http.js';
import { TEST_PACKS } from './test/packs.js';

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

async function listen(options: Partial<AppOptions> = {}): Promise<string> {
  server = createApp({ packs: TEST_PACKS, ...options }).listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe('HTTP app', () => {
  it('answers GET /healthz with 200 and {ok: true}', async () => {
    const base = await listen();
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('serves the built client, with index.html for client routes but not for /api or /socket.io', async () => {
    const clientDir = await mkdtemp(join(tmpdir(), 'sketchy-client-'));
    await writeFile(join(clientDir, 'index.html'), '<title>Sketchy test shell</title>');
    try {
      const base = await listen({ clientDir });
      for (const path of ['/', '/play/ABCD', '/screen/ABCD']) {
        const res = await fetch(`${base}${path}`);
        expect(res.status).toBe(200);
        expect(await res.text()).toContain('Sketchy test shell');
      }
      for (const path of ['/api/rooms', '/socket.io/']) {
        const res = await fetch(`${base}${path}`);
        expect(res.status).toBe(404);
        expect(await res.text()).not.toContain('Sketchy test shell');
      }
    } finally {
      await rm(clientDir, { recursive: true, force: true });
    }
  });

  it('caches hashed /assets/ for good and revalidates index.html and other files (F39)', async () => {
    const clientDir = await mkdtemp(join(tmpdir(), 'sketchy-client-'));
    await writeFile(join(clientDir, 'index.html'), '<title>Sketchy test shell</title>');
    await mkdir(join(clientDir, 'assets'));
    await writeFile(join(clientDir, 'assets', 'index-AbC123.js'), 'export {};');
    await writeFile(join(clientDir, 'favicon.svg'), '<svg/>');
    try {
      const base = await listen({ clientDir });
      const cache = async (path: string) =>
        (await fetch(`${base}${path}`)).headers.get('cache-control');
      expect(await cache('/assets/index-AbC123.js')).toBe('public, max-age=31536000, immutable');
      for (const path of ['/', '/index.html', '/play/ABCD', '/favicon.svg'])
        expect(await cache(path)).toBe('no-cache');
    } finally {
      await rm(clientDir, { recursive: true, force: true });
    }
  });

  it('serves no client in development, where Vite does', async () => {
    const base = await listen();
    expect((await fetch(`${base}/`)).status).toBe(404);
  });
});
