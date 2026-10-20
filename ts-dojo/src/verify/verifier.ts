// The verification store behind `:test` on a lesson page (§5 Verdict, §1 Exercise kinds): one
// per page, over the ts-ls client and the page's test runner. It follows `verifyExercise`
// group by group (`onProgress`), so the Tests tab can show the groups as they finish and the
// runtime tests as they stream; a newer `:test` supersedes an older one, whose late progress
// and verdict are dropped. Pure apart from what it is given, so verifier.test.ts drives it
// with a scripted verification.
import type { ProjectFile } from '@/protocol/ts-ls';
import type { EditorExercise } from '@/content/build-registry';
import {
  verifyExercise,
  type ExerciseResult,
  type GroupName,
  type PartialGroups,
  type RuntimeTests,
  type VerifyCore,
} from './exercise';

export interface VerifierState {
  /** Counts `:test` runs; 0 before the first. */
  run: number;
  status: 'idle' | 'running' | 'done' | 'error';
  /** The group being checked now. */
  phase: GroupName | null;
  /** The groups known so far (all four once done, only Compiles when it failed). */
  groups: PartialGroups;
  result: ExerciseResult | null;
  error: string | null;
}

export const IDLE_VERIFIER: VerifierState = {
  run: 0,
  status: 'idle',
  phase: null,
  groups: {},
  result: null,
  error: null,
};

export type VerifyFn = typeof verifyExercise;

export interface VerifierOptions {
  core: VerifyCore;
  runtime: RuntimeTests;
  /** `verifyExercise` unless a test scripts it. */
  verify?: VerifyFn;
}

/** Function properties, not methods: React's `useSyncExternalStore` takes `subscribe` unbound. */
export interface Verifier {
  readonly state: VerifierState;
  subscribe: (listener: () => void) => () => void;
  /** Verifies the files; resolves with the state this run ended in (or the newer run's). */
  verify: (
    exercise: EditorExercise,
    files: ProjectFile[],
  ) => Promise<VerifierState>;
  dispose: () => void;
}

export function createVerifier(options: VerifierOptions): Verifier {
  const verify = options.verify ?? verifyExercise;
  const listeners = new Set<() => void>();
  let state = IDLE_VERIFIER;
  let generation = 0;

  const set = (next: VerifierState): void => {
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    get state() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async verify(exercise, files) {
      generation += 1;
      const mine = generation;
      const current = (): boolean => mine === generation;
      const run = state.run + 1;
      set({
        run,
        status: 'running',
        phase: 'compiles',
        groups: {},
        result: null,
        error: null,
      });
      try {
        const result = await verify(
          options.core,
          options.runtime,
          exercise,
          files,
          {
            onProgress: ({ phase, groups }) => {
              if (!current() || phase === null) return;
              set({ ...state, phase, groups });
            },
          },
        );
        if (current()) {
          set({
            run,
            status: 'done',
            phase: null,
            groups: {
              compiles: result.compiles,
              typeCases: result.typeCases,
              runtime: result.runtime,
              rules: result.rules,
            },
            result,
            error: null,
          });
        }
      } catch (error) {
        if (current()) {
          set({
            ...state,
            status: 'error',
            phase: null,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return state;
    },
    // Not final: React's StrictMode unmounts and remounts once in development, and the page
    // keeps the same verifier, so a later `verify` works again (as the sandbox runner does).
    dispose() {
      generation += 1;
      listeners.clear();
    },
  };
}
