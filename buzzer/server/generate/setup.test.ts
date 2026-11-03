import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { openBuiltInStore, type BuiltInStore } from '../builtInStore.js';
import { parseAdminPasswordHash } from '../env.js';
import { createApp } from '../http.js';
import { adminHashFor } from '../test/admin.js';
import { T0 } from '../test/rooms.js';
import type { StreamingClient } from './anthropic.js';
import { anthropicGenerator, createJobRunner, type GenerateLevelFn } from './jobs.js';
import { GENERATE_FAKE_REFUSED, setUpGeneration, type GenerationEnv } from './setup.js';

const KEY = 'sk-ant-api03-SECRET-never-log-me-0123456789';

/** Every line written through the setup's logger. */
function capture() {
  const lines: string[] = [];
  return {
    lines,
    out: { log: (m: string) => lines.push(m), warn: (m: string) => lines.push(`WARN ${m}`) },
  };
}

const stub = (name: string): GenerateLevelFn =>
  Object.assign(() => Promise.reject(new Error(name)), { stubName: name });
const make = { fake: () => stub('fake'), real: (key: string) => stub(`real:${key}`) };
const nameOf = (fn: GenerateLevelFn | null) =>
  fn === null ? null : (fn as GenerateLevelFn & { stubName: string }).stubName;

describe('setUpGeneration (F112)', () => {
  it('is off with no key, and says so', () => {
    for (const value of [undefined, '', '  ']) {
      const { lines, out } = capture();
      const setup = setUpGeneration({ BUZZR_ANTHROPIC_API_KEY: value }, true, out, make);
      expect(setup.generate).toBeNull();
      expect(setup.dailyLimit).toBe(20);
      expect(lines).toEqual(['Question generator: off (no BUZZR_ANTHROPIC_API_KEY).']);
    }
  });

  it('runs the real generator with the trimmed key, under the daily limits', () => {
    const { lines, out } = capture();
    const setup = setUpGeneration(
      {
        BUZZR_ANTHROPIC_API_KEY: ` ${KEY}\n`,
        GENERATE_DAILY_LIMIT: '5',
        GENERATE_REPLACE_DAILY_LIMIT: '30',
      },
      true,
      out,
      make,
    );
    expect(nameOf(setup.generate)).toBe(`real:${KEY}`);
    expect(setup.dailyLimit).toBe(5);
    expect(setup.replaceDailyLimit).toBe(30);
    expect(lines).toEqual([
      'Question generator: on, at most 5 levels and 30 replacements a day (UTC).',
    ]);
  });

  it('allows 100 replacements a day by default, and stops on a bad GENERATE_REPLACE_DAILY_LIMIT (F113)', () => {
    const { out } = capture();
    expect(
      setUpGeneration({ BUZZR_ANTHROPIC_API_KEY: KEY }, true, out, make).replaceDailyLimit,
    ).toBe(100);
    expect(() =>
      setUpGeneration({ BUZZR_ANTHROPIC_API_KEY: KEY, GENERATE_REPLACE_DAILY_LIMIT: '0' }, true),
    ).toThrow(/GENERATE_REPLACE_DAILY_LIMIT/);
  });

  it('refuses GENERATE_FAKE=1 in production, with a warning', () => {
    const { lines, out } = capture();
    const setup = setUpGeneration(
      { BUZZR_ANTHROPIC_API_KEY: KEY, GENERATE_FAKE: '1' },
      true,
      out,
      make,
    );
    expect(nameOf(setup.generate)).toBe(`real:${KEY}`);
    expect(lines[0]).toBe(`WARN ${GENERATE_FAKE_REFUSED}`);

    const noKey = capture();
    expect(setUpGeneration({ GENERATE_FAKE: '1' }, true, noKey.out, make).generate).toBeNull();
    expect(noKey.lines[0]).toBe(`WARN ${GENERATE_FAKE_REFUSED}`);
  });

  it('runs the fake one for GENERATE_FAKE=1 in development, even with a key', () => {
    const { lines, out } = capture();
    const setup = setUpGeneration(
      { BUZZR_ANTHROPIC_API_KEY: KEY, GENERATE_FAKE: '1' },
      false,
      out,
      make,
    );
    expect(nameOf(setup.generate)).toBe('fake');
    // So the generation history logs its jobs at cost 0 (F127).
    expect(setup.fake).toBe(true);
    expect(lines).toEqual(['GENERATE_FAKE=1: the question generator is the fake one.']);
  });

  it('stops on a bad GENERATE_DAILY_LIMIT', () => {
    expect(() =>
      setUpGeneration({ BUZZR_ANTHROPIC_API_KEY: KEY, GENERATE_DAILY_LIMIT: '0' }, true),
    ).toThrow(/GENERATE_DAILY_LIMIT/);
  });
});

describe('the API key is never logged (F112)', () => {
  let dir: string;
  let store: BuiltInStore;
  let logged: unknown[][];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'buzzr-setup-'));
    store = await openBuiltInStore(dir);
    logged = [];
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  /** Everything written to the console so far, as Node would print it, errors and causes included. */
  const consoleText = () => logged.map((args) => inspect(args, { depth: 10 })).join('\n');

  it('at start-up, in every combination of the variables', () => {
    const envs: GenerationEnv[] = [
      { BUZZR_ANTHROPIC_API_KEY: KEY },
      { BUZZR_ANTHROPIC_API_KEY: KEY, GENERATE_DAILY_LIMIT: '3' },
      { BUZZR_ANTHROPIC_API_KEY: KEY, GENERATE_FAKE: '1' },
      { BUZZR_ANTHROPIC_API_KEY: KEY, GENERATE_FAKE: 'yes' },
    ];
    for (const env of envs) {
      for (const production of [true, false]) {
        // The real SDK client is built here: nothing it does on construction may print the key.
        setUpGeneration(env, production);
      }
    }
    expect(logged.length).toBeGreaterThan(0);
    expect(consoleText()).not.toContain(KEY);
    // A failed start prints the error message: it names the variable, not the key.
    let message = '';
    try {
      setUpGeneration({ BUZZR_ANTHROPIC_API_KEY: KEY, GENERATE_DAILY_LIMIT: 'x' }, true);
    } catch (err) {
      message = inspect(err);
    }
    expect(message).toMatch(/GENERATE_DAILY_LIMIT/);
    expect(message).not.toContain(KEY);
  });

  /** Runs one level through a job whose API calls fail with `err`; returns the job as served. */
  async function failedJob(generate: GenerateLevelFn) {
    const jobs = createJobRunner({ generate, store, clock: () => T0, dailyLimit: 20 });
    const started = jobs.start({
      kind: 'generate',
      category: 'Rivers',
      guidance: '',
      levels: [{ difficulty: 'easy', count: 5 }],
    });
    if (!started.ok) throw new Error(started.error);
    await jobs.idle();
    return jobs.get(started.job.id)!;
  }

  /** A client whose every request fails as the SDK would, with the key in the error. */
  const failingClient = (err: Error): StreamingClient => ({
    beta: { messages: { stream: () => ({ finalMessage: () => Promise.reject(err) }) } },
  });

  it.each([
    [
      'a refused key',
      Object.assign(new Error(`401 invalid x-api-key: ${KEY}`), {
        status: 401,
        headers: { 'x-api-key': KEY },
      }),
      'The Claude API refused the key. Check BUZZR_ANTHROPIC_API_KEY.',
    ],
    [
      'a server error',
      Object.assign(new Error(`500 internal error for ${KEY}`), { status: 500 }),
      'The Claude API is overloaded or down. Try again later.',
    ],
    [
      'a network failure',
      new Error(`fetch failed with x-api-key ${KEY}`),
      'Could not reach the Claude API. Check the connection and try again.',
    ],
  ])('when generation fails on %s', async (_name, err, message) => {
    const job = await failedJob(anthropicGenerator(failingClient(err)));
    expect(job.state).toBe('failed');
    expect(job.error).toBe(message);
    expect(JSON.stringify(job)).not.toContain(KEY);
    expect(consoleText()).not.toContain(KEY);
  });

  it('when the generator throws something unexpected', async () => {
    const job = await failedJob(() => Promise.reject(new Error(`boom ${KEY}`)));
    expect(job.error).toBe('Question generation failed unexpectedly. Try again.');
    expect(JSON.stringify(job)).not.toContain(KEY);
    expect(consoleText()).not.toContain(KEY);
  });

  it('through the admin routes, from the request to the failed job', async () => {
    const jobs = createJobRunner({
      generate: anthropicGenerator(
        failingClient(Object.assign(new Error(`401 invalid x-api-key: ${KEY}`), { status: 401 })),
      ),
      store,
      clock: () => T0,
      dailyLimit: 20,
    });
    const server = createApp({
      adminPassword: parseAdminPasswordHash(adminHashFor('pw')),
      clock: () => T0,
      builtIns: store,
      generateJobs: jobs,
    }).listen(0);
    try {
      await new Promise((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const headers = { origin: base, 'content-type': 'application/json' };
      const login = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ password: 'pw' }),
      });
      const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;
      const started = await fetch(`${base}/api/admin/categories/generate`, {
        method: 'POST',
        headers: { ...headers, cookie },
        body: JSON.stringify({
          category: 'Rivers',
          guidance: '',
          levels: [{ difficulty: 'easy', count: 5 }],
        }),
      });
      expect(started.status).toBe(202);
      const { jobId } = (await started.json()) as { jobId: string };
      await jobs.idle();
      const served = await (
        await fetch(`${base}/api/admin/jobs/${jobId}`, { headers: { cookie } })
      ).text();
      const listed = await (
        await fetch(`${base}/api/admin/categories`, { headers: { cookie } })
      ).text();
      expect(served).toContain('The Claude API refused the key.');
      expect(served + listed).not.toContain(KEY);
      expect(consoleText()).not.toContain(KEY);
    } finally {
      server.close();
    }
  });
});
