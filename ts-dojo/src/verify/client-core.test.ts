// `VerifyCore` over the browser's ts-ls client (§2, §5): the requests forward to the client and
// their payloads unwrap to the core's shapes; `openProject` sends nothing, because the editor
// already opened this very project and streams every edit with `updateFile`, and re-opening
// would reject the editor's own requests in flight.
import { describe, expect, it, vi } from 'vitest';
import type { Diag, EmittedFile, RuleHit, TypeCase } from '@/protocol/ts-ls';
import type { TsLsClient } from '@/workers/ts-ls/client';
import { verifyCoreOverClient } from './client-core';

const DIAG: Diag = {
  file: '/index.ts',
  start: 0,
  length: 1,
  line: 1,
  column: 1,
  code: 2322,
  message: 'no',
  category: 'error',
};

describe('verifyCoreOverClient', () => {
  it('forwards the four requests and leaves the project alone', async () => {
    const hits: RuleHit[] = [
      { rule: 'eval', file: '/index.ts', line: 2, column: 1, message: 'm' },
    ];
    const files: EmittedFile[] = [{ path: '/index.ts', js: '', imports: [] }];
    const cases: TypeCase[] = [{ name: 'case 1', ok: true, diagnostics: [] }];
    const client = {
      openProject: vi.fn(),
      getDiagnostics: vi.fn(() =>
        Promise.resolve({ diagnostics: [DIAG], versions: { '/index.ts': 3 } }),
      ),
      runTypeTests: vi.fn(() => Promise.resolve({ cases, outsideCases: [] })),
      lintAst: vi.fn(() => Promise.resolve(hits)),
      emit: vi.fn(() => Promise.resolve(files)),
    };
    const core = verifyCoreOverClient(client as unknown as TsLsClient);

    await core.openProject({ files: [{ path: '/index.ts', text: 'x' }] });
    expect(client.openProject).not.toHaveBeenCalled();

    expect(await core.getDiagnostics(['/index.ts'])).toEqual({
      diagnostics: [DIAG],
    });
    expect(client.getDiagnostics).toHaveBeenCalledWith(['/index.ts']);
    expect(await core.runTypeTests(['/tests.ts'])).toEqual({
      cases,
      outsideCases: [],
    });
    expect(await core.lintAst(['/index.ts'], ['explicit-any'])).toEqual({
      hits,
    });
    expect(client.lintAst).toHaveBeenCalledWith(
      ['/index.ts'],
      ['explicit-any'],
    );
    expect(await core.emit(['/index.ts', '/tests.ts'])).toEqual({ files });
    expect(client.emit).toHaveBeenCalledWith(
      ['/index.ts', '/tests.ts'],
      undefined,
    );
  });
});
