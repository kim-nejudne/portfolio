// The practice side of `/l/<lesson>/<exercise>` for an editor exercise (§6 Lesson page, §1
// Exercise kinds and Hints/solutions/reset/attempts, §5, §7): the exercise header, the prompt
// (`:prompt` shows or hides it), the hints shown so far, the editor over the working copy (the
// autosaved files over the starter; tests.ts is a user file, §5; `types/*.d.ts` read-only),
// the solution split (`:sol`), and the §4 output pane below. `:w` runs the entry file and
// `:test` runs the §5 verification; each writes an attempt row before the sandbox starts and
// completes it after (§9); a passing `:test` passes the exercise and re-checks the lesson.
// Commands about the page as a whole go to the lesson page (src/pages/lesson/page-action.ts).
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import { useAppActions } from '@/app/app-actions';
import { getCompiler } from '@/app/compiler';
import {
  OutputPane,
  type OutputTab,
  type OutputTests,
} from '@/app/output-pane';
import { createAppSandboxRunner } from '@/app/sandbox';
import { exerciseFiles, type EditorExercise } from '@/content/build-registry';
import { InlineText } from '@/content/components/inline-text';
import { confirmInPanel } from '@/editor/confirm';
import { Editor, type EditorFile } from '@/editor/editor';
import type { EditorHost, HostAction, RunModule } from '@/editor/host';
import { getActiveEditor, type EditorHandle } from '@/editor/registry';
import type { SourceLoc } from '@/protocol/sandbox';
import type { Diag, ProjectFile } from '@/protocol/ts-ls';
import { createAutosave, type Autosave } from '@/store/autosave';
import type { ExerciseRow } from '@/store/db';
import { browserStorage, readSettings, timeoutFor } from '@/store/settings';
import { dropUnsaved, journalUnsaved, peekUnsaved } from '@/store/unsaved';
import {
  attemptGroups,
  clearExerciseFiles,
  finishAttempt,
  markExercisePassed,
  recordHint,
  recordSolutionViewed,
  runGroups,
  saveExerciseFile,
  startAttempt,
} from '@/store/progress';
import { verifyCoreOverClient } from '@/verify/client-core';
import { runtimeTestsOn } from '@/verify/exercise';
import { currentTestRun, locateTest } from '@/verify/tests-view';
import { createVerifier } from '@/verify/verifier';
import { useLessonController } from './lesson/controller';
import { ExerciseHeader } from './lesson/exercise-header';
import { ExercisePrompt } from './lesson/exercise-prompt';
import { runLessonAction } from './lesson/page-action';

/**
 * The editor's files: the starter with any autosaved text over it (by path), tests.ts
 * editable, the lesson's `.d.ts` read-only.
 */
export function practiceFiles(
  exercise: EditorExercise,
  saved: Readonly<Record<string, string>> = {},
): EditorFile[] {
  return [
    ...exerciseFiles(exercise, 'starter').map((file) => ({
      ...file,
      text: saved[file.path] ?? file.text,
    })),
    ...exercise.dts.map((file) => ({ ...file, readOnly: true })),
  ];
}

/** What `:test` verifies: every editable file with its current text. */
export function liveFiles(editor: EditorHandle): ProjectFile[] {
  return editor.files
    .filter((file) => file.readOnly !== true)
    .map((file) => ({ path: file.path, text: editor.text(file.path) }));
}

const snapshotOf = (files: ProjectFile[]): Record<string, string> =>
  Object.fromEntries(files.map((file) => [file.path, file.text]));

/** The run's length for its attempt row: done or killed, 0 when it never ran. */
function runMs(status: {
  kind: string;
  durationMs?: number;
  afterMs?: number;
}) {
  return Math.round(status.durationMs ?? status.afterMs ?? 0);
}

export function Practice({
  exercise,
  row,
  outputRef,
}: {
  exercise: EditorExercise;
  /** The exercise's row, live: hints used and solution viewed. */
  row: ExerciseRow | undefined;
  outputRef: RefObject<HTMLElement | null>;
}) {
  const actions = useAppActions();
  const lesson = useLessonController();
  const [diagnostics, setDiagnostics] = useState<Diag[]>([]);
  const [tab, setTab] = useState<OutputTab>('console');
  // The working copy at mount: the stored text over the starter, and over that any text the
  // last unload interrupted (src/store/unsaved.ts); `:reset` replaces it.
  const [files, setFiles] = useState(() =>
    practiceFiles(exercise, { ...row?.files, ...peekUnsaved(exercise.id) }),
  );
  const [editorKey, setEditorKey] = useState(0);
  const [promptVisible, setPromptVisible] = useState(true);
  const [solutionOpen, setSolutionOpen] = useState(false);
  // `:w` and `:test` each have their own runner, so a run never ends the other's worker and
  // the verdict only ever reads a test run's results.
  const [runner] = useState(createAppSandboxRunner);
  const [testRunner] = useState(createAppSandboxRunner);
  const [verifier] = useState(() =>
    createVerifier({
      core: verifyCoreOverClient(getCompiler()),
      runtime: runtimeTestsOn(testRunner),
      // F10: an exercise without its own timeoutMs runs under the Settings default.
      defaultTimeoutMs: () => timeoutFor(null, readSettings(browserStorage())),
    }),
  );
  useEffect(
    () => () => {
      runner.dispose();
      testRunner.dispose();
      verifier.dispose();
    },
    [runner, testRunner, verifier],
  );
  const runState = useSyncExternalStore(
    runner.subscribe,
    () => runner.state,
    () => runner.state,
  );
  const testState = useSyncExternalStore(
    testRunner.subscribe,
    () => testRunner.state,
    () => testRunner.state,
  );
  const verifierState = useSyncExternalStore(
    verifier.subscribe,
    () => verifier.state,
    () => verifier.state,
  );
  // The test runner's run count when the last `:test` began: until that verification starts
  // its own run, the Tests tab must not show the previous run's results as live.
  const [testRunAtStart, setTestRunAtStart] = useState(0);

  // Text an unload interrupted goes into IndexedDB now, then leaves the journal.
  useEffect(() => {
    const unsaved = Object.entries(peekUnsaved(exercise.id));
    if (unsaved.length === 0) return;
    void Promise.all(
      unsaved.map(([path, text]) =>
        saveExerciseFile(exercise.id, exercise.lesson, path, text),
      ),
    ).then(() => dropUnsaved(exercise.id));
  }, [exercise]);

  // Autosave (§7: 500 ms after the last keystroke), flushed on unmount; on pagehide the waiting
  // texts also go to the synchronous journal, since IndexedDB does not finish during an unload.
  const autosaveRef = useRef<Autosave<string> | null>(null);
  useEffect(() => {
    const autosave = createAutosave<string>((path, text) => {
      void saveExerciseFile(exercise.id, exercise.lesson, path, text);
    });
    autosaveRef.current = autosave;
    const flush = (): void => {
      journalUnsaved(exercise.id, Object.fromEntries(autosave.pending()));
      autosave.flush();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      autosave.dispose();
      autosaveRef.current = null;
    };
  }, [exercise]);
  const onChange = useCallback((path: string, text: string): void => {
    autosaveRef.current?.touch(path, text);
  }, []);

  // A `:run` attempt is completed once its run has ended.
  const pendingRun = useRef<{ attempt: number; run: number } | null>(null);
  const diagnosticCount = useRef(0);
  useEffect(() => {
    diagnosticCount.current = diagnostics.length;
  }, [diagnostics]);
  useEffect(() => {
    const pending = pendingRun.current;
    if (pending === null || runState.run !== pending.run) return;
    const { status } = runState;
    if (
      status.kind !== 'done' &&
      status.kind !== 'killed' &&
      status.kind !== 'failed'
    ) {
      return;
    }
    pendingRun.current = null;
    void finishAttempt(pending.attempt, {
      passed: false,
      groups: runGroups(diagnosticCount.current),
      ms: runMs(status),
    });
  }, [runState]);

  // After `:reset` the editor remounts on the starter; give it the focus back.
  const focusAfterReset = useRef(false);
  useEffect(() => {
    if (!focusAfterReset.current) return;
    focusAfterReset.current = false;
    getActiveEditor()?.focus();
  }, [editorKey]);

  const jump = useCallback((loc: SourceLoc): void => {
    const editor = getActiveEditor();
    if (editor?.openFileAt(loc.file, loc.line, loc.column) !== true) {
      editor?.notify(`no file named ${loc.file.slice(1)}`);
    }
  }, []);

  const tests = useMemo<OutputTests>(
    () => ({
      verifier: verifierState,
      run: currentTestRun(testState, testRunAtStart),
      locateTest: (name) => {
        if (exercise.tests === undefined) return null;
        const path = `/${exercise.tests}`;
        const text = getActiveEditor()?.text(path) ?? '';
        return locateTest(path, text, name);
      },
    }),
    [verifierState, testState, testRunAtStart, exercise.tests],
  );

  const hintsUsed = row?.hintsUsed ?? 0;
  const solutionViewed = row?.solutionViewed === true;

  const host = useMemo<EditorHost>(() => {
    const notify = (text: string): void => lesson.notify(text);

    const run = async (modules: RunModule[], entry: string): Promise<void> => {
      setTab('console');
      const editor = getActiveEditor();
      try {
        const attempt = await startAttempt(
          exercise.id,
          exercise.lesson,
          'run',
          editor === null ? {} : snapshotOf(liveFiles(editor)),
        );
        pendingRun.current = { attempt, run: runner.state.run + 1 };
      } catch (error) {
        console.error('[store]', error);
      }
      await runner.start(modules, entry, {
        timeoutMs: timeoutFor(exercise, readSettings(browserStorage())),
      });
    };

    const test = async (editor: EditorHandle): Promise<void> => {
      setTab('tests');
      setTestRunAtStart(testRunner.state.run);
      const files = liveFiles(editor);
      let attempt: number | null = null;
      try {
        attempt = await startAttempt(
          exercise.id,
          exercise.lesson,
          'test',
          snapshotOf(files),
        );
      } catch (error) {
        console.error('[store]', error);
      }
      const startedAt = performance.now();
      const state = await verifier.verify(exercise, files);
      const result = state.result;
      if (result === null) return;
      if (attempt !== null) {
        await finishAttempt(attempt, {
          passed: result.passed,
          groups: attemptGroups(result),
          ms: Math.round(performance.now() - startedAt),
        });
      }
      if (result.passed) {
        await markExercisePassed(exercise.id, exercise.lesson);
        lesson.refreshCompletion();
      }
    };

    const hint = async (): Promise<void> => {
      const total = exercise.hints.length;
      if (total === 0) {
        notify('this exercise has no hints');
        return;
      }
      if (hintsUsed >= total) {
        notify(`no more hints: all ${String(total)} are shown`);
        return;
      }
      const shown = await recordHint(exercise.id, exercise.lesson, total);
      notify(`hint ${String(shown)} of ${String(total)}`);
    };

    const reset = async (editor: EditorHandle): Promise<void> => {
      const cm = editor.cm;
      if (cm === null) return;
      const yes = await confirmInPanel(cm, 'Reset to the starter files?');
      if (!yes) {
        notify('reset cancelled');
        return;
      }
      for (const file of files) autosaveRef.current?.forget(file.path);
      dropUnsaved(exercise.id);
      await clearExerciseFiles(exercise.id, exercise.lesson);
      focusAfterReset.current = true;
      setFiles(practiceFiles(exercise));
      setEditorKey((key) => key + 1);
      notify('restored the starter files; the attempts are kept');
    };

    return {
      run(modules, entry) {
        void run(modules, entry);
      },
      action(action: HostAction) {
        const editor = getActiveEditor();
        switch (action.type) {
          case 'test':
            if (editor !== null) void test(editor);
            return;
          case 'kill': {
            const killedRun = runner.kill();
            const killedTests = testRunner.kill();
            if (!killedRun && !killedTests) notify('nothing is running');
            return;
          }
          case 'hint':
            void hint();
            return;
          case 'solution':
            if (solutionOpen) {
              setSolutionOpen(false);
              notify('solution closed');
              return;
            }
            setSolutionOpen(true);
            if (!solutionViewed) {
              void recordSolutionViewed(exercise.id, exercise.lesson);
            }
            notify('the solution, read-only; :sol closes it');
            return;
          case 'reset':
            if (editor !== null) void reset(editor);
            return;
          case 'prompt':
            setPromptVisible((visible) => !visible);
            return;
          default:
            if (!runLessonAction(action, lesson, actions, 'editor')) {
              notify(`:${action.type} is not available here`);
            }
        }
      },
    };
  }, [
    actions,
    exercise,
    files,
    hintsUsed,
    lesson,
    runner,
    solutionOpen,
    solutionViewed,
    testRunner,
    verifier,
  ]);

  return (
    <section
      aria-label="Exercise"
      data-exercise={exercise.id}
      data-kind={exercise.kind}
      className="flex min-h-0 flex-1 flex-col"
    >
      <ExerciseHeader exercise={exercise} row={row} />
      {promptVisible && <ExercisePrompt exercise={exercise} />}
      {hintsUsed > 0 && (
        <ol
          data-testid="hints"
          aria-label="Hints"
          className="max-h-32 shrink-0 list-none overflow-auto border-b px-3 py-1 text-sm"
        >
          {exercise.hints.slice(0, hintsUsed).map((text, index) => (
            <li key={index} data-hint={index + 1}>
              <span className="font-medium">Hint {index + 1}.</span>{' '}
              <InlineText text={text} />
            </li>
          ))}
        </ol>
      )}
      <div className="flex min-h-0 flex-[3]" data-pane="editor">
        <Editor
          key={editorKey}
          files={files}
          entry={`/${exercise.entry}`}
          host={host}
          compilerOptions={exercise.compilerOptions}
          libs={exercise.libs}
          onChange={onChange}
          onDiagnostics={setDiagnostics}
          openPalette={actions.openPalette}
          className="min-h-0 min-w-0 flex-1"
        />
        {solutionOpen && (
          <section
            aria-label="Solution"
            data-testid="solution"
            className="w-1/2 shrink-0 overflow-auto border-l bg-muted/30 font-mono text-xs"
          >
            {exercise.solution.map((file) => (
              <figure key={file.path} data-path={file.path} className="m-0">
                <figcaption className="border-b px-2 py-1 text-muted-foreground">
                  {file.path.slice(1)} · solution, read-only
                </figcaption>
                <pre className="m-0 px-2 py-1 whitespace-pre">{file.text}</pre>
              </figure>
            ))}
          </section>
        )}
      </div>
      <OutputPane
        ref={outputRef}
        state={runState}
        diagnostics={diagnostics}
        tab={tab}
        onTabChange={setTab}
        onJump={jump}
        onEscape={() => getActiveEditor()?.focus()}
        tests={tests}
        className="flex-[2]"
      />
    </section>
  );
}
