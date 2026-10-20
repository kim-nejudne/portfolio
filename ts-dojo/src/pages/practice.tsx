// The practice side of `/l/<lesson>/<exercise>` for an editor exercise (§6 Lesson page, §1
// Exercise kinds, §5): the exercise header and prompt, the editor over the starter files, the
// exercise's tests.ts (a user file, §5) and its read-only `types/*.d.ts`, and the §4 output
// pane below. `:w` runs the entry file in a fresh sandbox worker; `:test` runs the §5
// verification over the editor's live texts through the one ts-ls client and a second runner
// in `mode: 'test'`, and the Tests tab follows it group by group. F8 builds the rest of the
// page around this: the exercise strip, the pane keys, hints, solution, reset, autosave and the
// attempts store.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
import { Editor, type EditorFile } from '@/editor/editor';
import type { EditorHost, HostAction, RunModule } from '@/editor/host';
import { getActiveEditor, type EditorHandle } from '@/editor/registry';
import type { SourceLoc } from '@/protocol/sandbox';
import type { Diag, ProjectFile } from '@/protocol/ts-ls';
import { verifyCoreOverClient } from '@/verify/client-core';
import { runtimeTestsOn } from '@/verify/exercise';
import { currentTestRun, locateTest } from '@/verify/tests-view';
import { createVerifier } from '@/verify/verifier';
import { NOT_ON_LESSON_PAGE } from './not-here';

/** The editor's files: the starter and tests.ts editable, the lesson's `.d.ts` read-only. */
export function practiceFiles(exercise: EditorExercise): EditorFile[] {
  return [
    ...exerciseFiles(exercise, 'starter'),
    ...exercise.dts.map((file) => ({ ...file, readOnly: true })),
  ];
}

/** What `:test` verifies: every editable file with its current text. */
export function liveFiles(editor: EditorHandle): ProjectFile[] {
  return editor.files
    .filter((file) => file.readOnly !== true)
    .map((file) => ({ path: file.path, text: editor.text(file.path) }));
}

export function Practice({ exercise }: { exercise: EditorExercise }) {
  const actions = useAppActions();
  const outputRef = useRef<HTMLElement>(null);
  const [diagnostics, setDiagnostics] = useState<Diag[]>([]);
  const [tab, setTab] = useState<OutputTab>('console');
  // `:w` and `:test` each have their own runner, so a run never ends the other's worker and
  // the verdict only ever reads a test run's results.
  const [runner] = useState(createAppSandboxRunner);
  const [testRunner] = useState(createAppSandboxRunner);
  const [verifier] = useState(() =>
    createVerifier({
      core: verifyCoreOverClient(getCompiler()),
      runtime: runtimeTestsOn(testRunner),
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
  const files = useMemo(() => practiceFiles(exercise), [exercise]);
  // The test runner's run count when the last `:test` began: until that verification starts
  // its own run, the Tests tab must not show the previous run's results as live.
  const [testRunAtStart, setTestRunAtStart] = useState(0);

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

  const host = useMemo<EditorHost>(
    () => ({
      run(modules: RunModule[], entry: string) {
        setTab('console');
        void runner.start(modules, entry);
      },
      action(action: HostAction) {
        const editor = getActiveEditor();
        switch (action.type) {
          case 'test':
            if (editor === null) return;
            setTab('tests');
            setTestRunAtStart(testRunner.state.run);
            void verifier.verify(exercise, liveFiles(editor));
            return;
          case 'kill': {
            const killedRun = runner.kill();
            const killedTests = testRunner.kill();
            if (!killedRun && !killedTests)
              editor?.notify('nothing is running');
            return;
          }
          case 'roadmap':
            actions.goToRoadmap();
            return;
          case 'help':
            actions.openHelp();
            return;
          case 'focusPane':
            if (action.pane === 'output') outputRef.current?.focus();
            else if (action.pane === 'editor') editor?.focus();
            else editor?.notify('the theory pane takes focus with F8');
            return;
          case 'focusDirection':
            if (action.direction === 'down') outputRef.current?.focus();
            else if (action.direction === 'up') editor?.focus();
            else if (action.direction === 'left') {
              editor?.notify('the theory pane takes focus with F8');
            } else editor?.notify('nothing to the right of the editor');
            return;
          default:
            editor?.notify(
              NOT_ON_LESSON_PAGE[action.type] ??
                `:${action.type} is not available here`,
            );
        }
      },
    }),
    [actions, exercise, runner, testRunner, verifier],
  );

  return (
    <section
      aria-label="Exercise"
      data-exercise={exercise.id}
      data-kind={exercise.kind}
      className="flex min-h-0 flex-1 flex-col"
    >
      <header className="shrink-0 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">{exercise.title}</h2>
        <span className="text-xs text-muted-foreground">
          {exercise.kind} · {exercise.minutes} min
        </span>
        <pre
          data-testid="prompt"
          className="mt-2 max-h-40 overflow-auto font-sans text-sm whitespace-pre-wrap"
        >
          {exercise.prompt.trim()}
        </pre>
      </header>
      <Editor
        files={files}
        entry={`/${exercise.entry}`}
        host={host}
        compilerOptions={exercise.compilerOptions}
        libs={exercise.libs}
        onDiagnostics={setDiagnostics}
        openPalette={actions.openPalette}
        className="min-h-0 flex-[3]"
      />
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
