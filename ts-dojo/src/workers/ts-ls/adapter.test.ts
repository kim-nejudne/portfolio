// The §2 protocol end to end in Node: the client and the worker adapter joined by an in-memory
// channel (messages structured-cloned, delivered a tick later, like postMessage), the real core,
// lib files from node_modules. Proves `init` → `ready { tsVersion: '6.0.3' }` (§12 F2), in-order
// handling (a getDiagnostics sent right after openProject answers once the project is open),
// requestId echoing, versions on file replies, `error` replies for refused and malformed
// messages, and that every reply survives structured cloning.
import { describe, expect, it, vi } from 'vitest';
import type { TsLsReply, TsLsRequest } from '@/protocol/ts-ls';
import { attachTsLs, type TsLsPort } from './adapter';
import {
  createTsLsClient,
  TsLsRequestError,
  WorkerRestartedError,
  type WorkerLike,
} from './client';
import { createTsLsCore } from './core';
import { nodeFetchLib } from './node/fetch-lib';

type Listener = (event: { data: unknown }) => void;

function channel() {
  const toWorker: Listener[] = [];
  const toClient: Listener[] = [];
  const sent: TsLsRequest[] = [];
  const received: TsLsReply[] = [];
  const deliver = (listeners: Listener[], message: unknown): void => {
    const data: unknown = structuredClone(message);
    queueMicrotask(() => {
      for (const listener of listeners) listener({ data });
    });
  };
  const workerPort: TsLsPort = {
    postMessage: (message) => {
      received.push(message);
      deliver(toClient, message);
    },
    addEventListener: (_type, listener) => {
      toWorker.push(listener);
    },
  };
  let terminated = false;
  const worker: WorkerLike = {
    postMessage: (message) => {
      sent.push(message);
      deliver(toWorker, message);
    },
    addEventListener: (type, listener) => {
      if (type === 'message') toClient.push(listener);
    },
    terminate: () => {
      terminated = true;
    },
  };
  return {
    workerPort,
    worker,
    sent,
    received,
    isTerminated: () => terminated,
  };
}

function connect() {
  const link = channel();
  attachTsLs(link.workerPort, createTsLsCore({ fetchLib: nodeFetchLib }));
  const onError = vi.fn();
  const onDropped = vi.fn();
  const client = createTsLsClient({
    spawn: () => link.worker,
    onError,
    onDropped,
  });
  return { ...link, client, onError, onDropped };
}

const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('client ↔ adapter over a channel, real core', () => {
  it('init replies ready with tsVersion 6.0.3 and the status follows (§12 F2)', async () => {
    const { client, sent, received } = connect();
    expect(client.status).toEqual({ state: 'loading', restarts: 0 });
    expect(sent[0]).toEqual({ type: 'init', requestId: 1 });

    await expect(client.whenReady()).resolves.toBe('6.0.3');
    expect(client.status).toEqual({
      state: 'ready',
      tsVersion: '6.0.3',
      restarts: 0,
    });
    expect(received[0]).toEqual({
      type: 'ready',
      requestId: 1,
      tsVersion: '6.0.3',
    });
    client.dispose();
  });

  it('a getDiagnostics sent right after openProject answers once the project is open, and every reply echoes a request', async () => {
    const { client, sent, received } = connect();
    client.openProject({
      files: [{ path: '/index.ts', text: 'const n: number = "x";\n' }],
    });
    const result = await client.getDiagnostics(['/index.ts']);
    expect(result.diagnostics.map((d) => [d.code, d.line, d.column])).toEqual([
      [2322, 1, 7],
    ]);
    expect(result.versions).toEqual({ '/index.ts': 0 });
    expect(sent.map((request) => request.type)).toEqual([
      'init',
      'openProject',
      'getDiagnostics',
    ]);
    expect(received.map((reply) => reply.type)).toEqual([
      'ready',
      'diagnostics',
    ]);
    for (const reply of received) {
      expect(
        sent.some((request) => request.requestId === reply.requestId),
      ).toBe(true);
    }
    client.dispose();
  });

  it('updateFile bumps the version and later replies carry it; the other requests travel the protocol', async () => {
    const { client, onError, onDropped } = connect();
    client.openProject({
      files: [
        {
          path: '/index.ts',
          text: 'const n: number = "x";\n',
        },
      ],
    });
    expect(client.updateFile('/index.ts', 'const n = 1;\n//    ^?\n')).toBe(1);
    expect(client.versionOf('/index.ts')).toBe(1);

    const diagnostics = await client.getDiagnostics(['/index.ts']);
    expect(diagnostics).toEqual({
      diagnostics: [],
      versions: { '/index.ts': 1 },
    });
    expect((await client.getQuickInfo('/index.ts', 6))?.text).toBe(
      'const n: 1',
    );
    expect(await client.getQuickInfo('/index.ts', 20)).toBeNull();
    expect((await client.getTwoslashQueries('/index.ts'))[0]?.text).toBe(
      'const n: 1',
    );
    const completions = await client.getCompletions('/index.ts', 12);
    expect(completions?.entries.some((entry) => entry.name === 'n')).toBe(true);
    expect(
      (await client.getCompletionDetails('/index.ts', 12, 'n'))?.text,
    ).toBe('const n: 1');
    expect(await client.getSignatureHelp('/index.ts', 12)).toBeNull();
    expect(await client.getDefinition('/index.ts', 6)).toEqual([
      { path: '/index.ts', start: 6, length: 1, line: 1, column: 7 },
    ]);
    const [emitted] = await client.emit(['/index.ts']);
    expect(emitted?.path).toBe('/index.ts');
    expect(emitted?.js).toContain(
      '//# sourceMappingURL=data:application/json;base64,',
    );
    expect(await client.lintAst(['/index.ts'], ['explicit-any'])).toEqual([]);
    expect(await client.runTypeTests(['/index.ts'])).toEqual({
      cases: [],
      outsideCases: [],
    });
    expect(onError).not.toHaveBeenCalled();
    expect(onDropped).not.toHaveBeenCalled();
    client.dispose();
  });

  it('a request the core refuses rejects with the error reply, and the client stays usable', async () => {
    const { client } = connect();
    client.openProject({
      files: [{ path: '/index.ts', text: 'export {};\n' }],
    });
    await expect(client.getDiagnostics(['/nope.ts'])).rejects.toThrow(
      TsLsRequestError,
    );
    await expect(client.getDiagnostics(['/nope.ts'])).rejects.toThrow(
      /\/nope\.ts is not a file of the project/,
    );
    await expect(client.lintAst(['/index.ts'], [])).resolves.toEqual([]);
    client.dispose();
  });

  it('a failing openProject surfaces through onError and a malformed message gets an error reply with requestId null', async () => {
    const { client, worker, received, onError } = connect();
    await client.whenReady();
    client.openProject({ files: [{ path: 'relative.ts', text: '' }] });
    await client.lintAst([], []);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(TsLsRequestError);
    expect((onError.mock.calls[0]?.[0] as Error).message).toMatch(
      /not an absolute path/,
    );

    worker.postMessage({ nonsense: true } as unknown as TsLsRequest);
    await tick();
    expect(received.at(-1)).toEqual({
      type: 'error',
      requestId: null,
      message: 'not a ts-ls request',
    });
    expect(onError).toHaveBeenCalledTimes(2);
    client.dispose();
  });

  it('dispose sends dispose, terminates the worker and rejects what is pending and what comes after', async () => {
    const { client, sent, isTerminated } = connect();
    const inFlight = client.getDiagnostics(['/nope.ts']);
    client.dispose();
    expect(sent.at(-1)?.type).toBe('dispose');
    expect(isTerminated()).toBe(true);
    await expect(inFlight).rejects.toBeInstanceOf(WorkerRestartedError);
    await expect(client.getDiagnostics([])).rejects.toBeInstanceOf(
      WorkerRestartedError,
    );
  });
});
