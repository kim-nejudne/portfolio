// The page's verification store behind `:test` (§5 Verdict, §12 F7): idle until the first run,
// then the phases as `verifyExercise` reports them, then the verdict; a newer `:test`
// supersedes an older one, whose late progress and result are dropped; a failure (the compiler
// restarted, the files changed under the request) ends in `error` with the message.
import { describe, expect, it, vi } from 'vitest';
import type { EditorExercise } from '@/content/build-registry';
import type { ExerciseResult, VerifyOptions, VerifyProgress } from './exercise';
import { createVerifier, IDLE_VERIFIER, type VerifyFn } from './verifier';

const RESULT: ExerciseResult = {
  compiles: { ok: true, diagnostics: [] },
  typeCases: { ok: true, cases: [] },
  runtime: { ok: true, tests: [] },
  rules: { ok: true, hits: [] },
  passed: true,
};

const EXERCISE = { id: 'm/l/e' } as EditorExercise;

interface Call {
  progress: (progress: VerifyProgress) => void;
  resolve: (result: ExerciseResult) => void;
  reject: (error: Error) => void;
}

/** A `verifyExercise` stand-in whose calls the test settles by hand. */
function scripted(): { verify: VerifyFn; calls: Call[] } {
  const calls: Call[] = [];
  const verify: VerifyFn = (_core, _runtime, _exercise, _files, options) =>
    new Promise<ExerciseResult>((resolve, reject) => {
      calls.push({
        progress: (progress) =>
          (options as VerifyOptions).onProgress?.(progress),
        resolve,
        reject,
      });
    });
  return { verify, calls };
}

function setup() {
  const { verify, calls } = scripted();
  const verifier = createVerifier({
    core: {} as never,
    runtime: () => Promise.reject(new Error('unused')),
    verify,
  });
  const listener = vi.fn();
  verifier.subscribe(listener);
  const call = (index: number): Call => calls[index] as Call;
  return { verifier, calls, call, listener };
}

describe('createVerifier', () => {
  it('starts idle', () => {
    const { verifier } = setup();
    expect(verifier.state).toEqual(IDLE_VERIFIER);
  });

  it('runs: running with the phases and groups reported, then done with the verdict', async () => {
    const { verifier, call, listener } = setup();
    const done = verifier.verify(EXERCISE, []);
    expect(verifier.state).toMatchObject({
      run: 1,
      status: 'running',
      phase: 'compiles',
      result: null,
    });
    call(0).progress({
      phase: 'rules',
      groups: { compiles: RESULT.compiles, typeCases: RESULT.typeCases },
    });
    expect(verifier.state).toMatchObject({
      status: 'running',
      phase: 'rules',
      groups: { compiles: RESULT.compiles, typeCases: RESULT.typeCases },
    });
    call(0).resolve(RESULT);
    await expect(done).resolves.toMatchObject({ status: 'done' });
    expect(verifier.state).toEqual({
      run: 1,
      status: 'done',
      phase: null,
      groups: {
        compiles: RESULT.compiles,
        typeCases: RESULT.typeCases,
        runtime: RESULT.runtime,
        rules: RESULT.rules,
      },
      result: RESULT,
      error: null,
    });
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('a newer :test supersedes an older one: the older progress and result are dropped', async () => {
    const { verifier, call } = setup();
    const first = verifier.verify(EXERCISE, []);
    const second = verifier.verify(EXERCISE, []);
    expect(verifier.state.run).toBe(2);
    call(0).progress({ phase: 'runtime', groups: {} });
    expect(verifier.state.phase).toBe('compiles');
    call(0).resolve({ ...RESULT, passed: false });
    await first;
    expect(verifier.state.status).toBe('running');
    call(1).resolve(RESULT);
    await second;
    expect(verifier.state).toMatchObject({
      run: 2,
      status: 'done',
      result: RESULT,
    });
  });

  it('ends in error with the message when the verification rejects', async () => {
    const { verifier, call } = setup();
    const done = verifier.verify(EXERCISE, []);
    call(0).reject(new Error('the compiler restarted'));
    await done;
    expect(verifier.state).toMatchObject({
      run: 1,
      status: 'error',
      phase: null,
      result: null,
      error: 'the compiler restarted',
    });
  });

  it('after dispose nothing changes and nobody is told', async () => {
    const { verifier, call, listener } = setup();
    const done = verifier.verify(EXERCISE, []);
    listener.mockClear();
    verifier.dispose();
    call(0).resolve(RESULT);
    await done;
    expect(listener).not.toHaveBeenCalled();
    expect(verifier.state.status).toBe('running');
  });
});

describe('the default timeout (F10)', () => {
  it('asks for the default at each :test and hands it to verifyExercise', async () => {
    const seen: (number | undefined)[] = [];
    let current = 1500;
    const verifier = createVerifier({
      core: {} as never,
      runtime: () => Promise.reject(new Error('unused')),
      verify: (_core, _runtime, _exercise, _files, options) => {
        seen.push(options?.defaultTimeoutMs);
        return Promise.resolve(RESULT);
      },
      defaultTimeoutMs: () => current,
    });
    await verifier.verify(EXERCISE, []);
    current = 9000;
    await verifier.verify(EXERCISE, []);
    expect(seen).toEqual([1500, 9000]);
  });
});
