// The worker side of the §2 protocol: a TsLsCore behind postMessage. Requests are handled one
// at a time in arrival order, so a `getDiagnostics` sent right after an `openProject` answers
// once the project (and its lib fetches) is open; `init` answers `ready { tsVersion }`;
// `openProject`, `updateFile` and `dispose` have no reply of their own (§2 lists none) and
// surface only as an `error` carrying their requestId when they fail. Pure apart from the port:
// worker.ts passes `self`, adapter.test.ts an in-memory port.
import type { TsLsReply, TsLsRequest } from '@/protocol/ts-ls';
import { TsLsError, type TsLsCore } from './core';

export interface TsLsPort {
  postMessage(message: TsLsReply): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void,
  ): void;
}

function isRequest(data: unknown): data is TsLsRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { type?: unknown }).type === 'string' &&
    typeof (data as { requestId?: unknown }).requestId === 'number'
  );
}

function requestIdOf(data: unknown): number | null {
  const id =
    typeof data === 'object' && data !== null
      ? (data as { requestId?: unknown }).requestId
      : undefined;
  return typeof id === 'number' ? id : null;
}

function errorReply(requestId: number | null, error: unknown): TsLsReply {
  if (error instanceof TsLsError) {
    return { type: 'error', requestId, message: error.message };
  }
  if (error instanceof Error) {
    return {
      type: 'error',
      requestId,
      message: error.message,
      ...(error.stack !== undefined ? { stack: error.stack } : {}),
    };
  }
  return { type: 'error', requestId, message: String(error) };
}

async function handle(
  core: TsLsCore,
  request: TsLsRequest,
): Promise<TsLsReply | null> {
  const { requestId } = request;
  switch (request.type) {
    case 'init': {
      const { tsVersion } = await core.init();
      return { type: 'ready', requestId, tsVersion };
    }
    case 'openProject':
      await core.openProject(request);
      return null;
    case 'updateFile':
      core.updateFile(request.path, request.text, request.version);
      return null;
    case 'getDiagnostics':
      return {
        type: 'diagnostics',
        requestId,
        ...core.getDiagnostics(request.paths),
      };
    case 'getQuickInfo':
      return {
        type: 'quickInfo',
        requestId,
        ...core.getQuickInfo(request.path, request.offset),
      };
    case 'getCompletions':
      return {
        type: 'completions',
        requestId,
        ...core.getCompletions(request.path, request.offset),
      };
    case 'getCompletionDetails':
      return {
        type: 'completionDetails',
        requestId,
        ...core.getCompletionDetails(
          request.path,
          request.offset,
          request.name,
        ),
      };
    case 'getSignatureHelp':
      return {
        type: 'signatureHelp',
        requestId,
        ...core.getSignatureHelp(request.path, request.offset),
      };
    case 'getDefinition':
      return {
        type: 'definition',
        requestId,
        ...core.getDefinition(request.path, request.offset),
      };
    case 'getTwoslashQueries':
      return {
        type: 'twoslash',
        requestId,
        ...core.getTwoslashQueries(request.path),
      };
    case 'emit':
      return {
        type: 'emitResult',
        requestId,
        ...core.emit(request.paths, request.module),
      };
    case 'lintAst':
      return {
        type: 'astLint',
        requestId,
        ...core.lintAst(request.paths, request.rules),
      };
    case 'runTypeTests':
      return {
        type: 'typeTestResults',
        requestId,
        ...core.runTypeTests(request.paths),
      };
    case 'checkCompilerOptions':
      return {
        type: 'compilerOptionsChecked',
        requestId,
        ...core.checkCompilerOptions(request.compilerOptions),
      };
    case 'dispose':
      core.dispose();
      return null;
    default: {
      const unknown: never = request;
      throw new TsLsError(
        `unknown request type ${String((unknown as { type: unknown }).type)}`,
      );
    }
  }
}

/** Serves `core` over `port` until the worker is terminated. */
export function attachTsLs(port: TsLsPort, core: TsLsCore): void {
  let queue: Promise<void> = Promise.resolve();
  port.addEventListener('message', (event) => {
    const { data } = event;
    if (!isRequest(data)) {
      port.postMessage({
        type: 'error',
        requestId: requestIdOf(data),
        message: 'not a ts-ls request',
      });
      return;
    }
    queue = queue.then(async () => {
      try {
        const reply = await handle(core, data);
        if (reply !== null) port.postMessage(reply);
      } catch (error) {
        port.postMessage(errorReply(data.requestId, error));
      }
    });
  });
}
