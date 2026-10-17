// `/repl` (spec §6, §4 "What REPL means here"): the editor with a fixed demo project for F3,
// two editable files and one read-only lesson-style `.d.ts`, so every §12 F3 criterion can be
// driven in Chrome, and below it the §4 output pane: `:w` emits the project and runs it in a
// fresh sandbox worker (F4), `:kill` ends a run, the Problems tab lists every file's
// diagnostics. F5 replaces the file set with the Dexie scratch buffers and adds `:e`/`:bd`.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useAppActions } from '@/app/app-actions';
import { OutputPane, type OutputTab } from '@/app/output-pane';
import { createAppSandboxRunner } from '@/app/sandbox';
import { Editor, type EditorFile } from '@/editor/editor';
import type { EditorHost, HostAction, RunModule } from '@/editor/host';
import { getActiveEditor } from '@/editor/registry';
import type { SourceLoc } from '@/protocol/sandbox';
import type { Diag } from '@/protocol/ts-ls';

export const DEMO_FILES: EditorFile[] = [
  {
    path: '/index.ts',
    text: `import { area, type Shape } from './shapes';

const circle: Shape = { kind: 'circle', radius: 2 };
const size = area(circle);
//    ^?

const unit: Unit = 'cm';
console.log(size.toFixed(2), unit);
`,
  },
  {
    path: '/shapes.ts',
    text: `export type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number };

/** The area of a shape, in square units. */
export function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.side ** 2;
  }
}
`,
  },
  {
    path: '/units.d.ts',
    text: `// Lesson-supplied declarations: read-only.
declare type Unit = 'cm' | 'in' | 'px';
`,
    readOnly: true,
  },
];

/** What a host answers for a command another feature's page owns. */
export const NOT_HERE: Partial<Record<HostAction['type'], string>> = {
  test: ':test runs the verification on a lesson page (F7)',
  hint: ':hint needs a lesson page (F8)',
  solution: ':sol needs a lesson page (F8)',
  reset: ':reset needs a lesson page (F8)',
  done: ':done needs a lesson page (F8)',
  next: ':next needs a lesson page (F8)',
  prev: ':prev needs a lesson page (F8)',
  lesson: ':lesson needs a lesson page (F8)',
  layout: ':layout needs a lesson page (F8)',
  prompt: ':prompt needs a lesson page (F8)',
  edit: ':e creates scratch buffers in /repl (F5)',
  bdelete: ':bd deletes scratch buffers in /repl (F5)',
  export: ':export needs the progress store (F9)',
};

export function ReplPage() {
  const actions = useAppActions();
  const outputRef = useRef<HTMLElement>(null);
  const [diagnostics, setDiagnostics] = useState<Diag[]>([]);
  const [tab, setTab] = useState<OutputTab>('console');
  const [runner] = useState(createAppSandboxRunner);
  useEffect(() => () => runner.dispose(), [runner]);
  const runState = useSyncExternalStore(
    runner.subscribe,
    () => runner.state,
    () => runner.state,
  );

  const jump = useCallback((loc: SourceLoc): void => {
    const editor = getActiveEditor();
    if (editor?.openFileAt(loc.file, loc.line, loc.column) !== true) {
      editor?.notify(`no file named ${loc.file.slice(1)}`);
    }
  }, []);

  const host = useMemo<EditorHost>(
    () => ({
      run(modules: RunModule[], entry: string) {
        setTab('console');
        void runner.start(modules, entry);
      },
      action(action: HostAction) {
        const editor = getActiveEditor();
        switch (action.type) {
          case 'kill':
            if (!runner.kill()) editor?.notify('nothing is running');
            return;
          case 'roadmap':
            actions.goToRoadmap();
            return;
          case 'help':
            actions.openHelp();
            return;
          case 'focusPane':
            if (action.pane === 'output') outputRef.current?.focus();
            else if (action.pane === 'editor') editor?.focus();
            else editor?.notify('no theory pane on /repl');
            return;
          case 'focusDirection':
            if (action.direction === 'down') outputRef.current?.focus();
            else if (action.direction === 'up') editor?.focus();
            else editor?.notify(`nothing to the ${action.direction} on /repl`);
            return;
          default:
            editor?.notify(
              NOT_HERE[action.type] ?? `:${action.type} is not available here`,
            );
        }
      },
    }),
    [actions, runner],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">REPL</h1>
      <Editor
        files={DEMO_FILES}
        entry="/index.ts"
        host={host}
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
        className="flex-1"
      />
    </div>
  );
}
