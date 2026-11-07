import { mkdtemp, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type AppOptions } from './http.js';

let server: Server | undefined;

async function start(options: AppOptions = {}): Promise<string> {
  server = createApp(options).listen(0);
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe('createApp', () => {
  it('answers /healthz with {ok: true}', async () => {
    const base = await start();
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('keeps an unknown API path a 404', async () => {
    const base = await start();
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found.' });
  });

  it('serves the client for client routes but never for /api', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pinpoint-client-'));
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>Pinpoint</title>');
    const base = await start({ clientDir: dir });

    const page = await fetch(`${base}/play/ABCD`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<title>Pinpoint</title>');

    expect((await fetch(`${base}/api/rooms/ABCD/missing`)).status).toBe(404);
  });

  it('does not advertise Express', async () => {
    const base = await start();
    const res = await fetch(`${base}/healthz`);
    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});
