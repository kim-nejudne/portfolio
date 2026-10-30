import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STARTER_SETS } from '../shared/starterSets/index.js';
import type { BuiltInSetsResponse } from '../shared/types.js';
import { openBuiltInStore, type BuiltInStore } from './builtInStore.js';
import { createApp, type AppOptions } from './http.js';
import { makeSet } from './test/rooms.js';

let dir: string;
let server: Server | undefined;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'buzzr-http-builtins-'));
});

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
  await rm(dir, { recursive: true, force: true });
});

async function listen(options?: AppOptions): Promise<string> {
  server = createApp(options).listen(0);
  await new Promise((resolve) => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe('GET /api/built-in-sets', () => {
  let builtIns: BuiltInStore;

  beforeEach(async () => {
    builtIns = await openBuiltInStore(dir);
  });

  it('returns the 60 seeded starters and sampleHidden false', async () => {
    const base = await listen({ builtIns });
    const res = await fetch(`${base}/api/built-in-sets`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    const body = (await res.json()) as BuiltInSetsResponse;
    expect(body).toEqual({ sets: STARTER_SETS, sampleHidden: false });
    expect(body.sets).toHaveLength(60);
  });

  it('never includes drafts', async () => {
    const draft = { ...makeSet(), title: 'SECRET DRAFT TITLE' };
    await builtIns.update((data) => ({ ...data, drafts: { [STARTER_SETS[0]!.id]: draft } }));
    const base = await listen({ builtIns });
    const res = await fetch(`${base}/api/built-in-sets`);
    const text = await res.text();
    expect(Object.keys(JSON.parse(text) as object).sort()).toEqual(['sampleHidden', 'sets']);
    expect(text).not.toContain('SECRET DRAFT TITLE');
    expect(text).not.toContain('drafts');
  });

  it('shows the latest file contents on each request', async () => {
    const base = await listen({ builtIns });
    await builtIns.update((data) => ({ ...data, sets: [makeSet(1)], sampleHidden: true }));
    const body = (await (await fetch(`${base}/api/built-in-sets`)).json()) as BuiltInSetsResponse;
    expect(body).toEqual({ sets: [makeSet(1)], sampleHidden: true });
  });
});

it('does not serve /api/built-in-sets without a store', async () => {
  const base = await listen();
  const res = await fetch(`${base}/api/built-in-sets`);
  expect(res.status).toBe(404);
});
