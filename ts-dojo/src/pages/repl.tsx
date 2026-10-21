// `/repl` (spec §6; §4 "What REPL means here": "named scratch buffers"): the editor over the
// §7 `buffers` table. On mount the buffers are read (the welcome pair seeded on the first
// visit) and the last buffer (`meta.lastBuffer`) opens first, with the editor focused in normal
// mode. `:e <name>` creates or switches, `:ls` lists, `:bd` deletes after a `y/n` prompt in the
// Vim panel; every edit is autosaved 500 ms after the last keystroke (§7). Below the editor the
// §4 output pane: `:w` runs the current buffer in a fresh sandbox worker (F4), `:kill` ends a
// run, the Problems tab lists every buffer's diagnostics.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useLocation } from 'react-router';
import { useAppActions } from '@/app/app-actions';
import { OutputPane, type OutputTab } from '@/app/output-pane';
import { setPageActions } from '@/app/page-actions';
import { createAppSandboxRunner } from '@/app/sandbox';
import { confirmInPanel } from '@/editor/confirm';
import { Editor, type EditorFile } from '@/editor/editor';
import type { EditorHost, HostAction, RunModule } from '@/editor/host';
import { getActiveEditor } from '@/editor/registry';
import type { SourceLoc } from '@/protocol/sandbox';
import type { Diag } from '@/protocol/ts-ls';
import { createAutosave, type Autosave } from '@/store/autosave';
import { browserStorage, readSettings, timeoutFor } from '@/store/settings';
import { useSettings } from '@/store/use-settings';
import {
  bufferPath,
  deleteBuffer,
  ensureBuffers,
  nameOfPath,
  normalizeBufferName,
  putBuffer,
  readLastBuffer,
  writeLastBuffer,
} from '@/store/buffers';
import { exportedMessage } from '@/app/export-progress';
import { NOT_HERE } from './not-here';
import { WELCOME_BUFFERS } from './welcome-buffers';

interface Project {
  files: EditorFile[];
  initial: string;
  /** The location that loaded it: a new navigation to /repl (Open in REPL) reloads and remounts. */
  key: string;
}

/** The stored buffers as editor files, the last buffer first to open. */
async function loadProject(key: string): Promise<Project> {
  const rows = await ensureBuffers(WELCOME_BUFFERS);
  const last = await readLastBuffer();
  const files = rows.map((row) => ({
    path: bufferPath(row.name),
    text: row.text,
  }));
  const first =
    files[0]?.path ?? bufferPath(WELCOME_BUFFERS[0]?.name ?? 'index.ts');
  const wanted = last === null ? first : bufferPath(last);
  return {
    files,
    initial: files.some((f) => f.path === wanted) ? wanted : first,
    key,
  };
}

export function ReplPage() {
  const actions = useAppActions();
  const { key: locationKey } = useLocation();
  const outputRef = useRef<HTMLElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diag[]>([]);
  const [tab, setTab] = useState<OutputTab>('console');
  const [runner] = useState(createAppSandboxRunner);
  // F10: scratch buffers take the Settings compiler defaults over §2; a change re-opens the
  // project in place.
  const { compilerDefaults } = useSettings();
  useEffect(() => () => runner.dispose(), [runner]);
  const runState = useSyncExternalStore(
    runner.subscribe,
    () => runner.state,
    () => runner.state,
  );

  // Autosave (§7: 500 ms after the last keystroke), flushed on pagehide and unmount.
  const autosaveRef = useRef<Autosave<string> | null>(null);
  useEffect(() => {
    const autosave = createAutosave<string>((path, text) => {
      void putBuffer(nameOfPath(path), text);
    });
    autosaveRef.current = autosave;
    const flush = (): void => autosave.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      autosave.dispose();
      autosaveRef.current = null;
    };
  }, []);

  // The buffers, read on mount and again on a new navigation here (Open in REPL from this very
  // page pushes a new location); pending autosaves are written first so the read is current.
  // A cancelled load leaves the state alone.
  useEffect(() => {
    let cancelled = false;
    autosaveRef.current?.flush();
    void loadProject(locationKey).then((loaded) => {
      if (!cancelled) setProject(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [locationKey]);

  // The last buffer (§12 F5: "/repl opens the last buffer"): the one open at mount, then every
  // switch. The editor is focused once it is mounted, in normal mode.
  useEffect(() => {
    if (project === null) return;
    void writeLastBuffer(nameOfPath(project.initial));
    getActiveEditor()?.focus();
  }, [project]);

  // The pane keys from outside the editor (§6): `2`/`Esc` and `Ctrl-k` the editor, `3` and
  // `Ctrl-j` the output pane; /repl has no theory pane.
  useEffect(
    () =>
      setPageActions({
        key(action) {
          if (action === 'focusEditor' || action === 'focusUp') {
            getActiveEditor()?.focus();
            return true;
          }
          if (action === 'focusOutput' || action === 'focusDown') {
            outputRef.current?.focus();
            return true;
          }
          return false;
        },
      }),
    [],
  );

  const onFileChange = useCallback((path: string): void => {
    void writeLastBuffer(nameOfPath(path));
  }, []);

  const onChange = useCallback((path: string, text: string): void => {
    autosaveRef.current?.touch(path, text);
  }, []);

  const jump = useCallback((loc: SourceLoc): void => {
    const editor = getActiveEditor();
    if (editor?.openFileAt(loc.file, loc.line, loc.column) !== true) {
      editor?.notify(`no buffer named ${loc.file.slice(1)}`);
    }
  }, []);

  const host = useMemo<EditorHost>(
    () => ({
      run(modules: RunModule[], entry: string) {
        setTab('console');
        // F10: the Settings default timeout, read at each run.
        void runner.start(modules, entry, {
          timeoutMs: timeoutFor(null, readSettings(browserStorage())),
        });
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
          case 'edit':
            void editBuffer(action.name);
            return;
          case 'bdelete':
            void deleteCurrentBuffer(autosaveRef.current);
            return;
          case 'export':
            void actions
              .exportProgress()
              .then((name) => editor?.notify(exportedMessage(name)));
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
      {project === null ? (
        <div
          role="status"
          aria-label="buffers"
          className="flex min-h-0 flex-[3] items-center justify-center text-sm text-muted-foreground"
        >
          loading buffers
        </div>
      ) : (
        <Editor
          key={project.key}
          files={project.files}
          initial={project.initial}
          {...(compilerDefaults !== undefined
            ? { compilerOptions: compilerDefaults }
            : {})}
          host={host}
          onChange={onChange}
          onFileChange={onFileChange}
          onDiagnostics={setDiagnostics}
          openPalette={actions.openPalette}
          className="min-h-0 flex-[3]"
        />
      )}
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

/** `:e <name>` (§4): opens the buffer, or creates an empty one and opens it. */
async function editBuffer(input: string): Promise<void> {
  const editor = getActiveEditor();
  if (editor === null) return;
  const name = normalizeBufferName(input);
  if (name === null) {
    editor.notify(
      `:e needs a file name such as notes or notes.ts, not "${input}"`,
    );
    return;
  }
  const path = bufferPath(name);
  if (editor.paths.includes(path)) {
    editor.openFile(path);
    return;
  }
  await putBuffer(name, '');
  const current = getActiveEditor();
  if (current === null) return;
  // Tabs stay in name order, the order a reload shows them in.
  const index = current.files.findIndex((f) => f.path > path);
  current.addFile({ path, text: '' }, index === -1 ? undefined : index);
  current.openFile(path);
  current.notify(`"${name}" [New]`);
}

/** `:bd` (§4): deletes the current buffer after a `y/n` prompt; never the last one. */
async function deleteCurrentBuffer(
  autosave: Autosave<string> | null,
): Promise<void> {
  const editor = getActiveEditor();
  if (editor === null || editor.cm === null) return;
  if (editor.files.length <= 1) {
    editor.notify('cannot delete the last buffer');
    return;
  }
  const path = editor.currentPath;
  const name = nameOfPath(path);
  const yes = await confirmInPanel(editor.cm, `Delete buffer "${name}"?`);
  if (!yes) return;
  autosave?.forget(path);
  await deleteBuffer(name);
  const current = getActiveEditor();
  if (current === null) return;
  current.removeFile(path);
  current.notify(`"${name}" deleted`);
}
