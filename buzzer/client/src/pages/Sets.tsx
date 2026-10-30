import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { Link, useNavigate } from 'react-router';
import { BUILT_IN_SETS } from '../../../shared/builtInSets.js';
import type { QuestionSet } from '../../../shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { GameBuilder } from '../components/GameBuilder.js';
import { RoomCreated } from '../components/RoomCreated.js';
import { SetBrowser } from '../components/SetBrowser.js';
import { SetPreview } from '../components/SetPreview.js';
import {
  createSet,
  deleteSet,
  duplicateBuiltIn,
  duplicateSet,
  getImage,
  importSet,
  listSets,
} from '../lib/db.js';
import { HOVER } from '../lib/hover.js';
import { BUTTON_DANGER, BUTTON_SMALL, LINK } from '../lib/ui.js';
import { hostSet } from '../lib/hostRoom.js';
import {
  exportAllFile,
  exportAllFileName,
  exportFileName,
  exportSetFile,
  IMPORT_ERRORS_SHOWN,
  IMPORT_FILE_MAX_BYTES,
  parseImportFile,
  type ExportAll,
} from '../lib/importExport.js';
import { loadLastExport, saveLastExport } from '../lib/lastExport.js';
import { formatEdited, setDetail } from '../lib/setLabels.js';

const LOAD_ERROR = 'Could not load the saved sets in this browser.';

/** Saves `text` as a file through a temporary link. */
function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  // Firefox follows only a link that is in the document.
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** One line of an import's error list: a file-level message, or a set of a many-set file. */
type ImportProblem = string | { label: string; errors: string[] };

const setCount = (count: number) => `${count} ${count === 1 ? 'set' : 'sets'}`;

type Tab = 'builtIn' | 'mine';

const TABS: { id: Tab; label: string }[] = [
  { id: 'builtIn', label: 'Built-in' },
  { id: 'mine', label: 'My sets' },
];

/** The tab a visit opens on: My sets once this browser has a set, else the built-in library. */
function firstTab(mine: readonly QuestionSet[]): Tab {
  return mine.length > 0 ? 'mine' : 'builtIn';
}

/**
 * Set list `/sets`: two tabs, the read-only **Built-in** library from the bundle and **My sets**,
 * this browser's saved sets, last edited first (DECISIONS F54).
 */
export function Sets() {
  const navigate = useNavigate();
  const [sets, setSets] = useState<QuestionSet[] | null>(null);
  const [tab, setTab] = useState<Tab>('builtIn');
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hostedCode, setHostedCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<{
    heading: string;
    problems: ImportProblem[];
  } | null>(null);
  const [exportSkipped, setExportSkipped] = useState<ExportAll['skipped']>([]);
  const [lastExport, setLastExport] = useState(loadLastExport);
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewing, setPreviewing] = useState<QuestionSet | null>(null);
  const [building, setBuilding] = useState(false);
  // One array per load, so the builder's category list and counts aren't redone on every render.
  const sources = useMemo(() => [...(sets ?? []), ...BUILT_IN_SETS], [sets]);

  const reload = useCallback(async () => {
    try {
      setSets(await listSets());
    } catch {
      setError(LOAD_ERROR);
    }
  }, []);

  useEffect(() => {
    let live = true;
    listSets().then(
      (loaded) => {
        if (!live) return;
        setSets(loaded);
        setTab(firstTab(loaded));
      },
      () => live && setError(LOAD_ERROR),
    );
    return () => {
      live = false;
    };
  }, []);

  /** Runs one action at a time; a failure shows its message above the list. */
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    setImportErrors(null);
    setExportSkipped([]);
    try {
      await action();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const newSet = () =>
    act(async () => {
      const set = await createSet();
      await navigate(`/sets/${set.id}`);
    });
  const duplicate = (id: string) =>
    act(async () => {
      await duplicateSet(id);
      await reload();
    });
  const duplicateToMine = (id: string) =>
    act(async () => {
      const copy = await duplicateBuiltIn(id);
      await reload();
      setNotice(`Copied “${copy.title}” to My sets.`);
      setTab('mine');
    });
  const remove = (id: string) =>
    act(async () => {
      await deleteSet(id);
      await reload();
    });
  const exportSet = (set: QuestionSet) =>
    act(async () => {
      const text = await exportSetFile(set, async (id) => (await getImage(id))?.blob);
      download(text, exportFileName(set.title));
    });
  const exportAll = (all: readonly QuestionSet[]) =>
    act(async () => {
      const result = await exportAllFile(all, async (id) => (await getImage(id))?.blob);
      setExportSkipped(result.skipped);
      if (result.exported === 0) {
        setError('Nothing to export: none of your sets is playable yet.');
        return;
      }
      const now = Date.now();
      const fileName = exportAllFileName(now);
      download(result.text, fileName);
      saveLastExport(now);
      setLastExport(now);
      setNotice(`Exported ${setCount(result.exported)} to ${fileName}.`);
    });
  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared, so choosing the same file again after a fix still fires `change`.
    event.target.value = '';
    if (!file) return;
    const refused = (problems: ImportProblem[]) =>
      setImportErrors({ heading: `Couldn't import ${file.name}:`, problems });
    void act(async () => {
      if (file.size > IMPORT_FILE_MAX_BYTES) {
        const limit = Math.round(IMPORT_FILE_MAX_BYTES / 1024 / 1024);
        refused([`The file is larger than ${limit} MB.`]);
        return;
      }
      const parsed = parseImportFile(await file.text());
      if (parsed.kind === 'bad') return refused(parsed.errors);
      if (parsed.kind === 'one') {
        if (!parsed.parsed.ok) return refused(parsed.parsed.errors);
        const imported = await importSet(parsed.parsed.set, parsed.parsed.images);
        setNotice(`Imported “${imported.title}”.`);
        await reload();
        setTab('mine');
        return;
      }

      // Each set on its own: the good ones are imported even when others are refused.
      const failed = parsed.sets.flatMap(({ label, parsed: entry }) =>
        entry.ok ? [] : [{ label, errors: entry.errors }],
      );
      if (failed.length > 0) {
        const shown: ImportProblem[] = failed.slice(0, IMPORT_ERRORS_SHOWN);
        if (failed.length > shown.length) {
          shown.push(`…and ${setCount(failed.length - shown.length)} more.`);
        }
        setImportErrors({
          heading: `Couldn't import ${failed.length} of ${setCount(parsed.sets.length)} from ${file.name}:`,
          problems: shown,
        });
      }
      let imported = 0;
      try {
        for (const { parsed: entry } of parsed.sets) {
          if (!entry.ok) continue;
          await importSet(entry.set, entry.images);
          imported += 1;
        }
      } finally {
        // Sets stored before a failed write still show, beside its error.
        if (imported > 0) {
          setNotice(`Imported ${setCount(imported)}.`);
          await reload();
          setTab('mine');
        }
      }
    });
  };
  const host = (set: QuestionSet) =>
    act(async () => {
      setHostedCode(await hostSet(set));
    });

  /** Arrow keys move between the tabs, as in the ARIA tabs pattern. */
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = TABS[(TABS.findIndex((t) => t.id === tab) + 1) % TABS.length]!.id;
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  if (hostedCode !== null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
        <RoomCreated code={hostedCode} />
        <button type="button" onClick={() => setHostedCode(null)} className={`${LINK} text-lg`}>
          Back to question sets
        </button>
      </main>
    );
  }

  return (
    // The preview is portaled out of `main`, so `inert` covers only the page behind it.
    <main
      inert={previewing !== null}
      className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl text-accent">Question sets</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setBuilding(true);
              setNotice(null);
              setError(null);
            }}
            disabled={busy || sets === null || building}
            className={`rounded-2xl border-2 border-accent px-5 py-3 font-display text-xl text-accent transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`}
          >
            Build a game
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy || sets === null}
            className={`rounded-2xl border-2 border-accent px-5 py-3 font-display text-xl text-accent transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`}
          >
            Import JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={importFile}
            hidden
            data-testid="import-file"
          />
          <button
            type="button"
            onClick={() => void newSet()}
            disabled={busy || sets === null}
            className={`rounded-2xl bg-accent px-5 py-3 font-display text-xl text-accent-ink transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`}
          >
            New set
          </button>
        </div>
      </div>

      <p role="status" className="text-lg text-win empty:hidden">
        {notice}
      </p>

      {exportSkipped.length > 0 && (
        <div className="flex flex-col gap-2 text-lg text-muted">
          <p>Skipped {setCount(exportSkipped.length)}:</p>
          <ul aria-label="Skipped sets" className="list-disc pl-6">
            {exportSkipped.map(({ title, reason }, i) => (
              <li key={i}>
                “{title}”: {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-lg text-buzz">
          {error}
        </p>
      )}

      {importErrors && (
        <div role="alert" className="flex flex-col gap-2 text-lg text-buzz">
          <p>{importErrors.heading}</p>
          <ul className="list-disc pl-6">
            {importErrors.problems.map((problem, i) =>
              typeof problem === 'string' ? (
                <li key={i}>{problem}</li>
              ) : (
                <li key={i}>
                  {problem.label}
                  <ul aria-label={problem.label} className="list-[circle] pl-6">
                    {problem.errors.map((message, j) => (
                      <li key={j}>{message}</li>
                    ))}
                  </ul>
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      {sets === null ? (
        error === null && <p className="text-muted">Loading…</p>
      ) : building ? (
        <section aria-labelledby="build-heading" className="flex flex-col gap-4">
          <h2 id="build-heading" className="font-display text-3xl">
            Build a game
          </h2>
          <GameBuilder
            sources={sources}
            hostLabel="Host this game"
            hostingLabel="Creating room…"
            onHost={async ({ set, loadImage }) => {
              const code = await hostSet(set, loadImage);
              setBuilding(false);
              setHostedCode(code);
            }}
            onSaved={(saved) => {
              setBuilding(false);
              setNotice(`Saved “${saved.title}” to My sets.`);
              setTab('mine');
              void reload();
            }}
            onBack={() => setBuilding(false)}
          />
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          <div role="tablist" aria-label="Question sets" className="flex gap-2">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                ref={(element) => {
                  tabRefs.current[id] = element;
                }}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={onTabKey}
                className={`min-h-11 rounded-xl border-2 px-4 py-2 font-display text-xl transition aria-selected:border-accent aria-selected:text-accent ${HOVER} border-edge text-muted`}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'builtIn' ? (
              <SetBrowser
                key="builtIn"
                mode="actions"
                id="built-in"
                sets={BUILT_IN_SETS}
                detail={(set) => setDetail(set, false)}
                onPreview={setPreviewing}
                actions={(set) => (
                  <>
                    <button
                      type="button"
                      onClick={() => void duplicateToMine(set.id)}
                      disabled={busy}
                      className={BUTTON_SMALL}
                    >
                      Duplicate to My sets
                    </button>
                    <button
                      type="button"
                      onClick={() => void host(set)}
                      disabled={busy}
                      className={`${BUTTON_SMALL} border-accent text-accent`}
                    >
                      Host this set
                    </button>
                  </>
                )}
              />
            ) : sets.length === 0 ? (
              <p className="rounded-[20px] border-2 border-dashed border-edge p-8 text-center text-lg text-muted">
                No question sets yet. Use <strong className="text-ink">New set</strong> to write
                one, or duplicate a built-in set.
              </p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[20px] border-2 border-edge p-4">
                  <p className="text-lg text-muted">
                    {lastExport === null ? (
                      <>
                        Never exported. Your sets live only in this browser: use{' '}
                        <strong className="text-ink">Export all</strong> now and then to keep a
                        backup file.
                      </>
                    ) : (
                      <>
                        Last export:{' '}
                        <time dateTime={new Date(lastExport).toISOString()}>
                          {formatEdited(lastExport)}
                        </time>
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => void exportAll(sets)}
                    disabled={busy}
                    className={BUTTON_SMALL}
                  >
                    Export all
                  </button>
                </div>
                <SetBrowser
                  key="mine"
                  mode="actions"
                  id="mine"
                  sets={sets}
                  onPreview={setPreviewing}
                  detail={(set) => (
                    <>
                      {setDetail(set, false)} · Last edited{' '}
                      <time dateTime={new Date(set.updatedAt).toISOString()}>
                        {formatEdited(set.updatedAt)}
                      </time>
                    </>
                  )}
                  actions={(set) => (
                    <>
                      <Link to={`/sets/${set.id}`} className={BUTTON_SMALL}>
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => void duplicate(set.id)}
                        disabled={busy}
                        className={BUTTON_SMALL}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => void exportSet(set)}
                        disabled={busy}
                        className={BUTTON_SMALL}
                      >
                        Export JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => void host(set)}
                        disabled={busy}
                        className={`${BUTTON_SMALL} border-accent text-accent`}
                      >
                        Host this set
                      </button>
                      {/* Destructive, so last in the row and red before it is armed (FND-07). */}
                      <ConfirmButton
                        label="Delete"
                        confirmLabel="Confirm delete"
                        onConfirm={() => void remove(set.id)}
                        disabled={busy}
                        className={BUTTON_DANGER}
                        cancelClassName={BUTTON_SMALL}
                      />
                    </>
                  )}
                />
              </>
            )}
          </div>
        </div>
      )}

      {previewing && (
        <SetPreview
          set={previewing}
          actionLabel="Host this set"
          onAction={(set) => void host(set)}
          onClose={() => setPreviewing(null)}
        />
      )}

      <Link to="/" className={`${LINK} self-center text-lg`}>
        Back to start
      </Link>
    </main>
  );
}
