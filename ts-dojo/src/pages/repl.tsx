// `/repl` (spec §6, §4 "What REPL means here"): the editor with a fixed demo project for F3,
// two editable files and one read-only lesson-style `.d.ts`, so every §12 F3 criterion can be
// driven in Chrome. Below it the output region: the Problems list (every file's diagnostics
// with file and line) and the host's messages. F4 turns the region into the output pane with
// its tabs and runs the modules `:w` hands over; F5 replaces the file set with the Dexie
// scratch buffers and adds `:e`/`:bd`.
import { useCallback, useMemo, useRef, useState } from 'react';
import { useAppActions } from '@/app/app-actions';
import { Editor, type EditorFile } from '@/editor/editor';
import type { EditorHost, HostAction, RunModule } from '@/editor/host';
import { getActiveEditor } from '@/editor/registry';
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
  kill: ':kill needs a running sandbox (F4)',
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
  const [messages, setMessages] = useState<string[]>([]);

  const say = useCallback((text: string): void => {
    setMessages((prev) => [...prev.slice(-19), text]);
  }, []);

  const host = useMemo<EditorHost>(
    () => ({
      run(modules: RunModule[], entry: string) {
        say(
          `emitted ${String(modules.length)} module${modules.length === 1 ? '' : 's'} (${modules
            .map((m) => m.path.slice(1))
            .join(', ')}); running ${entry.slice(1)} is F4`,
        );
      },
      action(action: HostAction) {
        const editor = getActiveEditor();
        switch (action.type) {
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
    [actions, say],
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
      {/* The output pane is a §4 focus target with its own keys (j/k/Enter at F4; Esc here), so it takes focus and key events itself. */}
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <section
        ref={outputRef}
        tabIndex={0}
        data-pane="output"
        aria-label="Output"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            getActiveEditor()?.focus();
          }
        }}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto border-t px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
      >
        <div>
          <h2 className="text-muted-foreground">
            Problems ({diagnostics.length})
          </h2>
          <ul data-testid="problems">
            {diagnostics.map((d, index) => (
              <li key={`${d.file}:${String(d.start)}:${String(index)}`}>
                <span className="text-muted-foreground">
                  {d.file.slice(1)}:{d.line}:{d.column}
                </span>{' '}
                {d.message}{' '}
                <span className="text-muted-foreground">TS{d.code}</span>
              </li>
            ))}
          </ul>
        </div>
        {messages.length > 0 && (
          <div>
            <h2 className="text-muted-foreground">Messages</h2>
            <ul data-testid="messages">
              {messages.map((message, index) => (
                <li key={String(index)}>{message}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
    </div>
  );
}
