// The main-thread side of the §2 protocol. Owns the ts-ls Worker for the app's lifetime and the
// invariants the spec puts on the UI: every request carries a requestId and resolves on the
// reply that echoes it; `updateFile` versions are monotonic per path; a reply with an older
// version than the file's current one is dropped (§2, §9 Staleness). On a worker crash (§9)
// the worker is terminated, respawned, `init` and the last `openProject` are re-sent with the
// current texts and versions, in-flight requests are rejected, and status listeners see
// `restarting` then `ready`; after too many crashes in a row the status is `failed`. Pure apart
// from the injected `spawn`, so client.test.ts drives it with a fake worker.
import {
  isTsLsReply,
  type CompilerOptionsJson,
  type CompletionDetailsResult,
  type CompletionsResult,
  type DefinitionLocation,
  type Diag,
  type EmittedFile,
  type EmitModuleKind,
  type FileVersions,
  type OpenProjectSpec,
  type QuickInfoResult,
  type RuleHit,
  type SignatureHelpResult,
  type TsLsReply,
  type TsLsReplyType,
  type TsLsRequest,
  type TwoslashQuery,
  type TypeCase,
} from '@/protocol/ts-ls';
import type { RuleId } from '@/verify/rules';

/** What the client needs from a Worker (or a test double). */
export interface WorkerLike {
  postMessage(message: TsLsRequest): void;
  addEventListener(
    type: 'message' | 'error' | 'messageerror',
    listener: (event: { data?: unknown; message?: string }) => void,
  ): void;
  terminate(): void;
}

export type CompilerStatus =
  | { state: 'loading'; restarts: number }
  | { state: 'ready'; tsVersion: string; restarts: number }
  | { state: 'restarting'; restarts: number }
  | { state: 'failed'; restarts: number; message: string };

/** The reply was computed against an older version of the file than the client holds. */
export class StaleReplyError extends Error {
  override readonly name = 'StaleReplyError';
  readonly path: string;
  readonly replyVersion: number;
  readonly currentVersion: number;
  constructor(path: string, replyVersion: number, currentVersion: number) {
    super(
      `stale reply for ${path}: version ${String(replyVersion)}, current ${String(currentVersion)}`,
    );
    this.path = path;
    this.replyVersion = replyVersion;
    this.currentVersion = currentVersion;
  }
}

/** The worker crashed (or was disposed) while the request was in flight. */
export class WorkerRestartedError extends Error {
  override readonly name = 'WorkerRestartedError';
}

/** The worker answered the request with an `error` reply. */
export class TsLsRequestError extends Error {
  override readonly name = 'TsLsRequestError';
}

/** `openProject` was called while the request was in flight: its reply would be about the previous project. */
export class ProjectChangedError extends Error {
  override readonly name = 'ProjectChangedError';
}

export interface TsLsClientOptions {
  spawn: () => WorkerLike;
  /** A reply that was dropped as stale. */
  onDropped?: (reply: TsLsReply) => void;
  /** A crash, a malformed reply, or an `error` reply for a request without a promise. */
  onError?: (error: Error) => void;
  /** Consecutive crashes without a `ready` in between before the status becomes `failed`. */
  maxConsecutiveRestarts?: number;
}

export interface TsLsClient {
  readonly status: CompilerStatus;
  /** A property, not a method, so React's useSyncExternalStore can take it unbound. */
  readonly subscribe: (
    listener: (status: CompilerStatus) => void,
  ) => () => void;
  /** Resolves with the tsVersion once the worker is ready (again, after a restart). */
  whenReady(): Promise<string>;
  openProject(spec: OpenProjectSpec): void;
  /** Sends the new text with the next version for the path and returns that version. */
  updateFile(path: string, text: string): number;
  versionOf(path: string): number;
  getDiagnostics(
    paths: string[],
  ): Promise<{ diagnostics: Diag[]; versions: FileVersions }>;
  getQuickInfo(path: string, offset: number): Promise<QuickInfoResult | null>;
  getCompletions(
    path: string,
    offset: number,
  ): Promise<CompletionsResult | null>;
  getCompletionDetails(
    path: string,
    offset: number,
    name: string,
  ): Promise<CompletionDetailsResult | null>;
  getSignatureHelp(
    path: string,
    offset: number,
  ): Promise<SignatureHelpResult | null>;
  getDefinition(path: string, offset: number): Promise<DefinitionLocation[]>;
  getTwoslashQueries(path: string): Promise<TwoslashQuery[]>;
  emit(paths: string[], module?: EmitModuleKind): Promise<EmittedFile[]>;
  lintAst(paths: string[], rules: RuleId[]): Promise<RuleHit[]>;
  runTypeTests(
    paths: string[],
  ): Promise<{ cases: TypeCase[]; outsideCases: Diag[] }>;
  /** F10: TypeScript's errors for options merged over the §2 defaults; [] when accepted. */
  checkCompilerOptions(compilerOptions: CompilerOptionsJson): Promise<string[]>;
  dispose(): void;
}

type RequestBody = TsLsRequest extends infer R
  ? R extends TsLsRequest
    ? Omit<R, 'requestId'>
    : never
  : never;

type ReplyOf<T extends TsLsReplyType> = Extract<TsLsReply, { type: T }>;

interface Pending {
  expect: TsLsReplyType;
  resolve: (reply: TsLsReply) => void;
  reject: (error: Error) => void;
}

interface TrackedFile {
  text: string;
  version: number;
}

export const DEFAULT_MAX_CONSECUTIVE_RESTARTS = 3;

export function createTsLsClient(options: TsLsClientOptions): TsLsClient {
  const maxConsecutiveRestarts =
    options.maxConsecutiveRestarts ?? DEFAULT_MAX_CONSECUTIVE_RESTARTS;
  let worker: WorkerLike | null = null;
  let nextRequestId = 1;
  const pending = new Map<number, Pending>();
  const files = new Map<string, TrackedFile>();
  let lastProject: OpenProjectSpec | null = null;
  let status: CompilerStatus = { state: 'loading', restarts: 0 };
  const listeners = new Set<(status: CompilerStatus) => void>();
  let readyWaiters: {
    resolve: (tsVersion: string) => void;
    reject: (error: Error) => void;
  }[] = [];
  let consecutiveCrashes = 0;
  let disposed = false;

  const setStatus = (next: CompilerStatus): void => {
    status = next;
    for (const listener of listeners) listener(next);
    if (next.state === 'ready' || next.state === 'failed') {
      const waiters = readyWaiters;
      readyWaiters = [];
      for (const waiter of waiters) {
        if (next.state === 'ready') waiter.resolve(next.tsVersion);
        else waiter.reject(new Error(next.message));
      }
    }
  };

  const send = (body: RequestBody): number => {
    const requestId = nextRequestId++;
    worker?.postMessage({ ...body, requestId });
    return requestId;
  };

  const request = <T extends TsLsReplyType>(
    body: RequestBody,
    expect: T,
  ): Promise<ReplyOf<T>> =>
    new Promise<ReplyOf<T>>((resolve, reject) => {
      if (disposed) {
        reject(new WorkerRestartedError('the ts-ls client is disposed'));
        return;
      }
      const requestId = send(body);
      pending.set(requestId, {
        expect,
        // onMessage checks `reply.type === expect` before resolving.
        resolve: (reply) => resolve(reply as ReplyOf<T>),
        reject,
      });
    });

  const staleness = (reply: TsLsReply): StaleReplyError | null => {
    if ('versions' in reply) {
      for (const [path, version] of Object.entries(reply.versions)) {
        const current = files.get(path)?.version ?? 0;
        if (version < current)
          return new StaleReplyError(path, version, current);
      }
      return null;
    }
    if ('path' in reply && 'version' in reply) {
      const current = files.get(reply.path)?.version ?? 0;
      if (reply.version < current) {
        return new StaleReplyError(reply.path, reply.version, current);
      }
    }
    return null;
  };

  const onMessage = (event: { data?: unknown }): void => {
    const reply = event.data;
    if (!isTsLsReply(reply)) {
      options.onError?.(new Error('malformed reply from the ts-ls worker'));
      return;
    }
    if (reply.type === 'ready') {
      consecutiveCrashes = 0;
      setStatus({
        state: 'ready',
        tsVersion: reply.tsVersion,
        restarts: status.restarts,
      });
    }
    const { requestId } = reply;
    const entry = requestId === null ? undefined : pending.get(requestId);
    if (requestId === null || entry === undefined) {
      // Not awaited (openProject, updateFile, dispose, an old request): only an error matters.
      if (reply.type === 'error') {
        options.onError?.(new TsLsRequestError(reply.message));
      }
      return;
    }
    pending.delete(requestId);
    if (reply.type === 'error') {
      entry.reject(new TsLsRequestError(reply.message));
      return;
    }
    const stale = staleness(reply);
    if (stale !== null) {
      options.onDropped?.(reply);
      entry.reject(stale);
      return;
    }
    if (reply.type !== entry.expect) {
      entry.reject(
        new TsLsRequestError(
          `expected a ${entry.expect} reply, got ${reply.type}`,
        ),
      );
      return;
    }
    entry.resolve(reply);
  };

  const rejectPending = (error: Error): void => {
    const entries = [...pending.values()];
    pending.clear();
    for (const entry of entries) entry.reject(error);
  };

  const currentProjectFiles = (
    spec: OpenProjectSpec,
  ): OpenProjectSpec['files'] =>
    spec.files.map((file) => {
      const tracked = files.get(file.path);
      return tracked === undefined
        ? file
        : { path: file.path, text: tracked.text, version: tracked.version };
    });

  const onCrash = (event: { message?: string }): void => {
    if (disposed || worker === null) return;
    const message =
      typeof event.message === 'string' && event.message.length > 0
        ? event.message
        : 'the ts-ls worker crashed';
    worker.terminate();
    worker = null;
    const error = new WorkerRestartedError(message);
    rejectPending(error);
    options.onError?.(error);
    consecutiveCrashes += 1;
    const restarts = status.restarts + 1;
    if (consecutiveCrashes > maxConsecutiveRestarts) {
      setStatus({ state: 'failed', restarts, message });
      return;
    }
    setStatus({ state: 'restarting', restarts });
    start();
  };

  const start = (): void => {
    const spawned = options.spawn();
    worker = spawned;
    spawned.addEventListener('message', onMessage);
    spawned.addEventListener('error', onCrash);
    spawned.addEventListener('messageerror', onCrash);
    // The ready reply is handled in onMessage; the promise only matters if the worker dies first.
    request({ type: 'init' }, 'ready').catch(() => undefined);
    if (lastProject !== null) {
      send({
        type: 'openProject',
        ...lastProject,
        files: currentProjectFiles(lastProject),
      });
    }
  };

  const client: TsLsClient = {
    get status() {
      return status;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    whenReady() {
      if (status.state === 'ready') return Promise.resolve(status.tsVersion);
      if (status.state === 'failed') {
        return Promise.reject(new Error(status.message));
      }
      return new Promise((resolve, reject) => {
        readyWaiters.push({ resolve, reject });
      });
    },

    openProject(spec) {
      lastProject = spec;
      files.clear();
      for (const file of spec.files) {
        files.set(file.path, { text: file.text, version: file.version ?? 0 });
      }
      // Replies to requests still in flight would be about the previous project, and every
      // path restarts at version 0, so the version check could not tell: reject them now and
      // their late replies are ignored as unknown ids.
      rejectPending(
        new ProjectChangedError(
          'the project changed while the request was in flight',
        ),
      );
      send({ type: 'openProject', ...spec });
    },

    updateFile(path, text) {
      const version = (files.get(path)?.version ?? 0) + 1;
      files.set(path, { text, version });
      send({ type: 'updateFile', path, text, version });
      return version;
    },

    versionOf(path) {
      return files.get(path)?.version ?? 0;
    },

    async getDiagnostics(paths) {
      const reply = await request(
        { type: 'getDiagnostics', paths },
        'diagnostics',
      );
      return { diagnostics: reply.diagnostics, versions: reply.versions };
    },

    async getQuickInfo(path, offset) {
      return (
        await request({ type: 'getQuickInfo', path, offset }, 'quickInfo')
      ).info;
    },

    async getCompletions(path, offset) {
      return (
        await request({ type: 'getCompletions', path, offset }, 'completions')
      ).completions;
    },

    async getCompletionDetails(path, offset, name) {
      return (
        await request(
          { type: 'getCompletionDetails', path, offset, name },
          'completionDetails',
        )
      ).details;
    },

    async getSignatureHelp(path, offset) {
      return (
        await request(
          { type: 'getSignatureHelp', path, offset },
          'signatureHelp',
        )
      ).help;
    },

    async getDefinition(path, offset) {
      return (
        await request({ type: 'getDefinition', path, offset }, 'definition')
      ).locations;
    },

    async getTwoslashQueries(path) {
      return (await request({ type: 'getTwoslashQueries', path }, 'twoslash'))
        .queries;
    },

    async emit(paths, module) {
      return (
        await request(
          { type: 'emit', paths, ...(module !== undefined ? { module } : {}) },
          'emitResult',
        )
      ).files;
    },

    async lintAst(paths, rules) {
      return (await request({ type: 'lintAst', paths, rules }, 'astLint')).hits;
    },

    async runTypeTests(paths) {
      const reply = await request(
        { type: 'runTypeTests', paths },
        'typeTestResults',
      );
      return { cases: reply.cases, outsideCases: reply.outsideCases };
    },

    async checkCompilerOptions(compilerOptions) {
      return (
        await request(
          { type: 'checkCompilerOptions', compilerOptions },
          'compilerOptionsChecked',
        )
      ).errors;
    },

    dispose() {
      if (disposed) return;
      send({ type: 'dispose' });
      disposed = true;
      rejectPending(new WorkerRestartedError('the ts-ls client is disposed'));
      worker?.terminate();
      worker = null;
      listeners.clear();
    },
  };

  start();
  return client;
}
