// The editor (spec §2 Editor, §4): file tabs above one CodeMirror view, the vimrc status line
// below. The React side only renders the tabs and the vimrc errors; the view, the per-file
// states and every key live in controller.ts. `files` is the mount-time set (§4: an exercise's
// "file set is fixed"; a page gives a new `key` for a new project); the tabs follow the
// controller's live set, which `/repl` grows and shrinks with `:e` and `:bd`.
import { useEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import { getCompiler } from '@/app/compiler';
import type { CompilerOptionsJson, Diag } from '@/protocol/ts-ls';
import { basename } from './buffers';
import {
  createEditorController,
  type EditorController,
  type EditorFile,
} from './controller';
import type { EditorHost } from './host';
import { formatVimrcError, type VimrcError } from './vimrc';

export type { EditorFile } from './controller';

export interface EditorProps {
  files: EditorFile[];
  /** The file `:w` runs; absent means the current file (`/repl`). */
  entry?: string;
  /** The file opened first; `files[0]` when absent. */
  initial?: string;
  host: EditorHost;
  /** The current file changed (a switch by `:b`, `gt`, `gd`, a tab or the output pane). */
  onFileChange?: (path: string) => void;
  compilerOptions?: CompilerOptionsJson;
  libs?: string[];
  onChange?: (path: string, text: string) => void;
  onDiagnostics?: (diagnostics: Diag[]) => void;
  openPalette: () => void;
  className?: string;
}

export function Editor(props: EditorProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<EditorController | null>(null);
  // Mount-time inputs and the latest callbacks, read by the controller through refs so the
  // view is created once and never re-created on a re-render.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const [current, setCurrent] = useState(
    props.initial ?? props.files[0]?.path ?? '',
  );
  const [files, setFiles] = useState<readonly EditorFile[]>(props.files);
  const [vimrcErrors, setVimrcErrors] = useState<VimrcError[]>([]);

  useEffect(() => {
    const parent = parentRef.current;
    if (parent === null) return;
    const initial = latest.current;
    const controller = createEditorController({
      parent,
      files: initial.files,
      ...(initial.entry !== undefined ? { entry: initial.entry } : {}),
      ...(initial.initial !== undefined ? { initial: initial.initial } : {}),
      compiler: getCompiler(),
      host: () => latest.current.host,
      ...(initial.compilerOptions !== undefined
        ? { compilerOptions: initial.compilerOptions }
        : {}),
      ...(initial.libs !== undefined ? { libs: initial.libs } : {}),
      onFileChange: (path) => {
        setCurrent(path);
        latest.current.onFileChange?.(path);
      },
      onFilesChange: setFiles,
      onVimrcErrors: setVimrcErrors,
      onChange: (path, text) => latest.current.onChange?.(path, text),
      onDiagnostics: (diagnostics) =>
        latest.current.onDiagnostics?.(diagnostics),
      openPalette: () => latest.current.openPalette(),
    });
    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
      controller.destroy();
    };
  }, []);

  return (
    <div className={cn('flex min-h-0 flex-col', props.className)}>
      <div
        role="tablist"
        aria-label="Files"
        className="flex shrink-0 items-end gap-1 border-b px-2 pt-1 text-xs"
      >
        {files.map((file) => {
          const selected = file.path === current;
          return (
            <button
              key={file.path}
              type="button"
              role="tab"
              aria-selected={selected}
              data-path={file.path}
              data-readonly={file.readOnly === true ? 'true' : undefined}
              tabIndex={-1}
              onClick={() => controllerRef.current?.openFile(file.path)}
              className={cn(
                'flex items-center gap-1.5 rounded-t border border-b-0 px-2.5 py-1 font-mono',
                selected
                  ? 'bg-background text-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {basename(file.path)}
              {file.readOnly === true && (
                <span
                  className="rounded bg-muted-foreground/15 px-1 text-[10px] uppercase tracking-wide"
                  title="Lesson-supplied declarations: read-only"
                >
                  read-only
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        ref={parentRef}
        className="min-h-0 flex-1 overflow-hidden"
        data-testid="editor"
      />
      <div
        role="status"
        aria-label="vimrc"
        className={cn(
          'shrink-0 border-t px-2 py-1 font-mono text-xs text-destructive',
          vimrcErrors.length === 0 && 'hidden',
        )}
      >
        {vimrcErrors.map((error) => (
          <div key={error.line}>{formatVimrcError(error)}</div>
        ))}
      </div>
    </div>
  );
}
