// The client's own invariants with a scripted fake worker: §12 F2 "a reply with an older
// `version` than the file's current one is dropped by the client" (for a `versions` map and a
// single-file reply), replies with unknown requestIds ignored, `error` replies rejecting their
// request, and the §9 restart: a crashed worker is terminated and respawned, `init` and the
// last project (with the current texts and versions) are re-sent, in-flight requests are
// rejected, the status goes restarting → ready, and too many crashes in a row end in `failed`.
import { describe, expect, it, vi } from 'vitest';
import type { Diag, TsLsReply, TsLsRequest } from '@/protocol/ts-ls';
import {
  createTsLsClient,
  ProjectChangedError,
  StaleReplyError,
  TsLsRequestError,
  WorkerRestartedError,
  type CompilerStatus,
  type WorkerLike,
} from './client';

interface FakeWorker {
  worker: WorkerLike;
  posted: TsLsRequest[];
  reply: (reply: TsLsReply) => void;
  crash: (message?: string) => void;
  terminated: () => boolean;
}

function fakeWorker(): FakeWorker {
  const posted: TsLsRequest[] = [];
  const onMessage: ((event: { data?: unknown }) => void)[] = [];
  const onError: ((event: { message?: string }) => void)[] = [];
  let terminated = false;
  const worker: WorkerLike = {
    postMessage: (message) => {
      posted.push(message);
    },
    addEventListener: (type, listener) => {
      if (type === 'message') onMessage.push(listener);
      if (type === 'error') onError.push(listener);
    },
    terminate: () => {
      terminated = true;
    },
  };
  return {
    worker,
    posted,
    reply: (reply) => {
      for (const listener of onMessage) listener({ data: reply });
    },
    crash: (message = 'boom') => {
      for (const listener of onError) listener({ message });
    },
    terminated: () => terminated,
  };
}

function setup(maxConsecutiveRestarts?: number) {
  const workers: FakeWorker[] = [];
  const onDropped = vi.fn();
  const onError = vi.fn();
  const statuses: CompilerStatus[] = [];
  const client = createTsLsClient({
    spawn: () => {
      const spawned = fakeWorker();
      workers.push(spawned);
      return spawned.worker;
    },
    onDropped,
    onError,
    ...(maxConsecutiveRestarts === undefined ? {} : { maxConsecutiveRestarts }),
  });
  client.subscribe((status) => statuses.push(status));
  const current = (): FakeWorker => workers[workers.length - 1] as FakeWorker;
  const ready = (): void => {
    const init = current().posted.find((request) => request.type === 'init');
    current().reply({
      type: 'ready',
      requestId: init?.requestId ?? -1,
      tsVersion: '6.0.3',
    });
  };
  const lastRequestId = (): number =>
    current().posted[current().posted.length - 1]?.requestId ?? -1;
  return {
    client,
    workers,
    current,
    ready,
    lastRequestId,
    onDropped,
    onError,
    statuses,
  };
}

const diag = (code: number): Diag => ({
  file: '/index.ts',
  start: 0,
  length: 1,
  line: 1,
  column: 1,
  code,
  message: `code ${String(code)}`,
  category: 'error',
});

describe('ready', () => {
  it('sends init first and becomes ready on the ready reply', async () => {
    const { client, current, ready, statuses } = setup();
    expect(current().posted).toEqual([{ type: 'init', requestId: 1 }]);
    expect(client.status).toEqual({ state: 'loading', restarts: 0 });
    const pending = client.whenReady();
    ready();
    await expect(pending).resolves.toBe('6.0.3');
    expect(client.status).toEqual({
      state: 'ready',
      tsVersion: '6.0.3',
      restarts: 0,
    });
    expect(statuses).toEqual([
      { state: 'ready', tsVersion: '6.0.3', restarts: 0 },
    ]);
    await expect(client.whenReady()).resolves.toBe('6.0.3');
  });
});

describe('stale replies (§12 F2: dropped by the client)', () => {
  it('drops a diagnostics reply whose versions are older than the file, and delivers a current one', async () => {
    const { client, current, ready, lastRequestId, onDropped } = setup();
    ready();
    client.openProject({ files: [{ path: '/index.ts', text: 'v0' }] });
    expect(client.updateFile('/index.ts', 'v1')).toBe(1);
    const first = client.getDiagnostics(['/index.ts']);
    const firstId = lastRequestId();
    expect(client.updateFile('/index.ts', 'v2')).toBe(2);
    expect(current().posted.at(-1)).toEqual({
      type: 'updateFile',
      requestId: expect.any(Number) as number,
      path: '/index.ts',
      text: 'v2',
      version: 2,
    });

    const stale: TsLsReply = {
      type: 'diagnostics',
      requestId: firstId,
      diagnostics: [diag(2322)],
      versions: { '/index.ts': 1 },
    };
    current().reply(stale);
    await expect(first).rejects.toBeInstanceOf(StaleReplyError);
    await expect(first).rejects.toMatchObject({
      path: '/index.ts',
      replyVersion: 1,
      currentVersion: 2,
    });
    expect(onDropped).toHaveBeenCalledTimes(1);
    expect(onDropped).toHaveBeenCalledWith(stale);

    const second = client.getDiagnostics(['/index.ts']);
    current().reply({
      type: 'diagnostics',
      requestId: lastRequestId(),
      diagnostics: [],
      versions: { '/index.ts': 2 },
    });
    await expect(second).resolves.toEqual({
      diagnostics: [],
      versions: { '/index.ts': 2 },
    });
    expect(onDropped).toHaveBeenCalledTimes(1);
  });

  it('drops a single-file reply (quickInfo) with an older version and keeps a newer one', async () => {
    const { client, current, ready, lastRequestId, onDropped } = setup();
    ready();
    client.openProject({ files: [{ path: '/index.ts', text: 'v0' }] });
    client.updateFile('/index.ts', 'v1');
    const info = client.getQuickInfo('/index.ts', 0);
    const infoId = lastRequestId();
    client.updateFile('/index.ts', 'v2');
    current().reply({
      type: 'quickInfo',
      requestId: infoId,
      path: '/index.ts',
      version: 1,
      info: null,
    });
    await expect(info).rejects.toBeInstanceOf(StaleReplyError);
    expect(onDropped).toHaveBeenCalledTimes(1);

    const again = client.getQuickInfo('/index.ts', 0);
    current().reply({
      type: 'quickInfo',
      requestId: lastRequestId(),
      path: '/index.ts',
      version: 2,
      info: null,
    });
    await expect(again).resolves.toBeNull();
  });

  it('a reply about a file the client never updated is never stale', async () => {
    const { client, current, ready, lastRequestId } = setup();
    ready();
    const queries = client.getTwoslashQueries('/types/x.d.ts');
    current().reply({
      type: 'twoslash',
      requestId: lastRequestId(),
      path: '/types/x.d.ts',
      version: 0,
      queries: [],
    });
    await expect(queries).resolves.toEqual([]);
  });
});

describe('openProject', () => {
  it('rejects requests still in flight for the previous project and ignores their late replies', async () => {
    const { client, current, ready, lastRequestId, onDropped, onError } =
      setup();
    ready();
    client.openProject({ files: [{ path: '/index.ts', text: 'a' }] });
    const stale = client.getDiagnostics(['/index.ts']);
    const staleId = lastRequestId();

    client.openProject({ files: [{ path: '/index.ts', text: 'b' }] });
    await expect(stale).rejects.toBeInstanceOf(ProjectChangedError);
    expect(current().posted.at(-1)).toMatchObject({
      type: 'openProject',
      files: [{ path: '/index.ts', text: 'b' }],
    });

    current().reply({
      type: 'diagnostics',
      requestId: staleId,
      diagnostics: [diag(2322)],
      versions: { '/index.ts': 0 },
    });
    expect(onDropped).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    const fresh = client.getDiagnostics(['/index.ts']);
    current().reply({
      type: 'diagnostics',
      requestId: lastRequestId(),
      diagnostics: [],
      versions: { '/index.ts': 0 },
    });
    await expect(fresh).resolves.toEqual({
      diagnostics: [],
      versions: { '/index.ts': 0 },
    });
  });
});

describe('replies that match no request', () => {
  it('ignores a reply with an unknown requestId and keeps waiting for the right one', async () => {
    const { client, current, ready, lastRequestId, onError } = setup();
    ready();
    const pending = client.getDiagnostics(['/index.ts']);
    const id = lastRequestId();
    current().reply({
      type: 'diagnostics',
      requestId: 999,
      diagnostics: [diag(1)],
      versions: {},
    });
    let settled = false;
    void pending.finally(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    current().reply({
      type: 'diagnostics',
      requestId: id,
      diagnostics: [],
      versions: { '/index.ts': 0 },
    });
    await expect(pending).resolves.toEqual({
      diagnostics: [],
      versions: { '/index.ts': 0 },
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('rejects a request on an error reply, reports an unmatched error through onError, and rejects a reply of the wrong type', async () => {
    const { client, current, ready, lastRequestId, onError } = setup();
    ready();
    const pending = client.getDiagnostics(['/nope.ts']);
    current().reply({
      type: 'error',
      requestId: lastRequestId(),
      message: '/nope.ts is not a file of the project',
    });
    await expect(pending).rejects.toThrow(TsLsRequestError);
    await expect(pending).rejects.toThrow(
      '/nope.ts is not a file of the project',
    );

    current().reply({ type: 'error', requestId: null, message: 'worker-side' });
    expect(onError).toHaveBeenCalledTimes(1);

    const mismatched = client.getQuickInfo('/index.ts', 0);
    current().reply({
      type: 'diagnostics',
      requestId: lastRequestId(),
      diagnostics: [],
      versions: {},
    });
    await expect(mismatched).rejects.toThrow(/expected a quickInfo reply/);
  });
});

describe('restart on a crash (§9 Staleness and failure)', () => {
  it('terminates and respawns the worker, re-sends init and the last project with the current texts and versions, rejects in-flight requests, and reports restarting then ready', async () => {
    const { client, workers, current, ready, statuses, onError } = setup();
    ready();
    client.openProject({
      files: [
        { path: '/index.ts', text: 'original' },
        { path: '/other.ts', text: 'untouched' },
      ],
      libs: ['dom'],
    });
    client.updateFile('/index.ts', 'edited');
    const inFlight = client.getDiagnostics(['/index.ts']);
    const first = current();

    first.crash('out of memory');
    await expect(inFlight).rejects.toBeInstanceOf(WorkerRestartedError);
    expect(first.terminated()).toBe(true);
    expect(workers).toHaveLength(2);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(client.status).toEqual({ state: 'restarting', restarts: 1 });

    const second = current();
    expect(second.posted.map((request) => request.type)).toEqual([
      'init',
      'openProject',
    ]);
    expect(second.posted[1]).toMatchObject({
      type: 'openProject',
      libs: ['dom'],
      files: [
        { path: '/index.ts', text: 'edited', version: 1 },
        { path: '/other.ts', text: 'untouched', version: 0 },
      ],
    });

    ready();
    expect(client.status).toEqual({
      state: 'ready',
      tsVersion: '6.0.3',
      restarts: 1,
    });
    expect(statuses.map((status) => status.state)).toEqual([
      'ready',
      'restarting',
      'ready',
    ]);

    // Versions continue: a reply at the pre-crash version is current, not stale.
    const after = client.getDiagnostics(['/index.ts']);
    second.reply({
      type: 'diagnostics',
      requestId: second.posted[second.posted.length - 1]?.requestId ?? -1,
      diagnostics: [],
      versions: { '/index.ts': 1 },
    });
    await expect(after).resolves.toEqual({
      diagnostics: [],
      versions: { '/index.ts': 1 },
    });
  });

  it('gives up after too many crashes in a row and rejects whenReady', async () => {
    const { client, current, workers, statuses } = setup(2);
    const waiting = client.whenReady();
    current().crash();
    current().crash();
    current().crash();
    expect(workers).toHaveLength(3);
    expect(client.status).toEqual({
      state: 'failed',
      restarts: 3,
      message: 'boom',
    });
    await expect(waiting).rejects.toThrow('boom');
    await expect(client.whenReady()).rejects.toThrow('boom');
    expect(statuses.map((status) => status.state)).toEqual([
      'restarting',
      'restarting',
      'failed',
    ]);
  });

  it('a ready in between resets the crash count', () => {
    const { client, current, ready, workers } = setup(1);
    current().crash();
    ready();
    current().crash();
    ready();
    expect(workers).toHaveLength(3);
    expect(client.status).toEqual({
      state: 'ready',
      tsVersion: '6.0.3',
      restarts: 2,
    });
  });

  it('unsubscribe stops status updates', () => {
    const { client, ready } = setup();
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);
    unsubscribe();
    ready();
    expect(listener).not.toHaveBeenCalled();
  });
});
