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
import { GameBuilder } from '../components/GameBuilder.js';
import { OverflowMenu, type MenuItem } from '../components/OverflowMenu.js';
import { PageShell } from '../components/PageShell.js';
import { RoomCreated } from '../components/RoomCreated.js';
import { SetBrowser } from '../components/SetBrowser.js';
import { SetPreview } from '../components/SetPreview.js';
import { Toast, useToast } from '../components/Toast.js';
import {
  createSet,
  deleteSet,
  duplicateBuiltIn,
  duplicateSet,
  getImage,
  importSet,
  listSets,
} from '../lib/db.js';
import {
  BUTTON_OUTLINE,
  BUTTON_PRIMARY,
  BUTTON_PRIMARY_SMALL,
  BUTTON_SMALL,
  LINK,
} from '../lib/ui.js';
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

/** A card's title: a link to the set, at least 44px tall, clamped to two lines (LIB-02). */
const TITLE_LINK =
  'line-clamp-2 min-h-11 py-2 text-left underline-offset-4 decoration-accent hover:underline';

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
  const { toast, show } = useToast();
  const feedbackRef = useRef<HTMLDivElement>(null);
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

  // An import's or an export's result can be long, so it stays on the page, scrolled to (LIB-04).
  useEffect(() => {
    if (notice === null && error === null && importErrors === null && exportSkipped.length === 0)
      return;
    // Optional: a browser (or jsdom) without it still shows the result, just unscrolled.
    feedbackRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [notice, error, importErrors, exportSkipped]);

  function clearFeedback() {
    setError(null);
    setNotice(null);
    setImportErrors(null);
    setExportSkipped([]);
  }

  /** Runs one page action at a time; a failure shows its message above the list. */
  async function act(action: () => Promise<void>) {
    setBusy(true);
    clearFeedback();
    try {
      await action();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Runs one card action at a time. Its outcome, or its failure, is a toast at the foot of the
   * window, so it shows wherever the card is (LIB-04).
   */
  async function cardAct(action: () => Promise<string | void>) {
    setBusy(true);
    clearFeedback();
    try {
      const done = await action();
      if (done) show(done, 'done');
    } catch (caught) {
      show((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const newSet = () =>
    act(async () => {
      const set = await createSet();
      await navigate(`/sets/${set.id}`);
    });
  const duplicate = (set: QuestionSet) =>
    cardAct(async () => {
      await duplicateSet(set.id);
      await reload();
      return `Duplicated “${set.title}”.`;
    });
  const duplicateToMine = (id: string) =>
    cardAct(async () => {
      const copy = await duplicateBuiltIn(id);
      await reload();
      setTab('mine');
      return `Copied “${copy.title}” to My sets.`;
    });
  const remove = (set: QuestionSet) =>
    cardAct(async () => {
      await deleteSet(set.id);
      await reload();
      return `Deleted “${set.title}”.`;
    });
  const exportSet = (set: QuestionSet) =>
    cardAct(async () => {
      const text = await exportSetFile(set, async (id) => (await getImage(id))?.blob);
      download(text, exportFileName(set.title));
      return `Exported “${set.title}”.`;
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
    cardAct(async () => {
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
      <PageShell width="narrow">
        <RoomCreated code={hostedCode} />
        <button type="button" onClick={() => setHostedCode(null)} className={`${LINK} text-lg`}>
          Back to question sets
        </button>
      </PageShell>
    );
  }

  const counts: Record<Tab, number | null> = {
    builtIn: BUILT_IN_SETS.length,
    mine: sets === null ? null : sets.length,
  };

  const header = (
    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:gap-6">
      {/* Home without scrolling, at every size (LIB-08). */}
      <Link to="/" className={`${LINK} self-start text-lg xl:self-auto`}>
        ← Buzzr
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between xl:flex-1">
        <h1 className="font-display text-3xl text-accent md:text-4xl">Question sets</h1>
        {/* New set first at every size; on a phone, the other two share the row under it (LIB-03). */}
        <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex">
          <button
            type="button"
            onClick={() => void newSet()}
            disabled={busy || sets === null}
            className={`${BUTTON_PRIMARY} col-span-2 text-lg`}
          >
            New set
          </button>
          <button
            type="button"
            onClick={() => {
              setBuilding(true);
              clearFeedback();
            }}
            disabled={busy || sets === null || building}
            className={`${BUTTON_OUTLINE} text-base sm:text-lg`}
          >
            Build a game
          </button>
          <OverflowMenu
            label="Backup"
            trigger="Backup ▾"
            disabled={busy || sets === null}
            triggerClassName={`${BUTTON_OUTLINE} w-full text-base sm:text-lg`}
            items={[
              { label: 'Import JSON', onSelect: () => fileInput.current?.click() },
              {
                label: 'Export all',
                onSelect: () => void exportAll(sets ?? []),
                disabled: sets === null || sets.length === 0,
              },
            ]}
          />
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={importFile}
            hidden
            data-testid="import-file"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* The preview is portaled out of the page, so `inert` covers only the page behind it. */}
      <div inert={previewing !== null}>
        <PageShell width="wide" header={header}>
          <div ref={feedbackRef} className="flex scroll-mt-4 flex-col gap-3 empty:hidden">
            {notice && (
              <p role="status" className="text-lg text-win">
                {notice}
              </p>
            )}

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
          </div>

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
              {/* A tab bar, not chips: an underline under the open tab, and a count (LIB-05). */}
              <div
                role="tablist"
                aria-label="Question sets"
                className="flex gap-2 border-b-2 border-edge"
              >
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
                    className="-mb-0.5 flex min-h-11 items-center gap-2 border-b-4 border-transparent px-3 pb-1 font-display text-xl text-muted transition hover:text-ink aria-selected:border-accent aria-selected:text-accent"
                  >
                    {label}{' '}
                    <span className="rounded-full bg-edge px-2 font-sans text-sm font-bold text-ink tabular-nums empty:hidden">
                      {counts[id]}
                    </span>
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
                    // A built-in set is read-only, so its title opens the preview.
                    cardTitle={(set) => (
                      <button
                        type="button"
                        onClick={() => setPreviewing(set)}
                        className={TITLE_LINK}
                      >
                        {set.title}
                      </button>
                    )}
                    actions={(set) => (
                      <CardActions
                        set={set}
                        busy={busy}
                        onHost={(chosen) => void host(chosen)}
                        onPreview={setPreviewing}
                        menu={[
                          {
                            label: 'Duplicate to My sets',
                            onSelect: () => void duplicateToMine(set.id),
                          },
                        ]}
                      />
                    )}
                  />
                ) : sets.length === 0 ? (
                  <p className="rounded-[20px] border-2 border-dashed border-edge p-8 text-center text-lg text-muted">
                    No question sets yet. Use <strong className="text-ink">New set</strong> to write
                    one, or duplicate a built-in set.
                  </p>
                ) : (
                  <>
                    {/* One line, kept beside the sets it backs up (LIB-03). */}
                    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-muted">
                      <p>
                        {lastExport === null ? (
                          'Never exported. Your sets live only in this browser.'
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
                      detail={(set) => (
                        <>
                          {setDetail(set, false)} · Last edited{' '}
                          <time dateTime={new Date(set.updatedAt).toISOString()}>
                            {formatEdited(set.updatedAt)}
                          </time>
                        </>
                      )}
                      cardTitle={(set) => (
                        <Link to={`/sets/${set.id}`} className={TITLE_LINK}>
                          {set.title}
                        </Link>
                      )}
                      actions={(set) => (
                        <CardActions
                          set={set}
                          busy={busy}
                          onHost={(chosen) => void host(chosen)}
                          onPreview={setPreviewing}
                          menu={[
                            { label: 'Open', to: `/sets/${set.id}` },
                            { label: 'Duplicate', onSelect: () => void duplicate(set) },
                            { label: 'Export JSON', onSelect: () => void exportSet(set) },
                            // Destructive, so last and red, and it asks again (FND-07).
                            {
                              label: 'Delete',
                              confirmLabel: 'Confirm delete',
                              onSelect: () => void remove(set),
                            },
                          ]}
                        />
                      )}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          <Link to="/" className={`${LINK} self-center text-lg`}>
            Back to start
          </Link>
        </PageShell>
      </div>

      {previewing && (
        <SetPreview
          set={previewing}
          actionLabel="Host this set"
          onAction={(set) => void host(set)}
          onClose={() => setPreviewing(null)}
        />
      )}
      <Toast toast={toast} />
    </>
  );
}

/**
 * A set card's action row (LIB-02): **Host**, the one primary, then Preview, then `⋯` with the
 * rest. Each button names its set, as every card has the same three.
 */
function CardActions({
  set,
  busy,
  onHost,
  onPreview,
  menu,
}: {
  set: QuestionSet;
  busy: boolean;
  onHost: (set: QuestionSet) => void;
  onPreview: (set: QuestionSet) => void;
  menu: MenuItem[];
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onHost(set)}
        disabled={busy}
        aria-label={`Host ${set.title}`}
        className={BUTTON_PRIMARY_SMALL}
      >
        Host
      </button>
      <button
        type="button"
        onClick={() => onPreview(set)}
        aria-label={`Preview ${set.title}`}
        className={BUTTON_SMALL}
      >
        Preview
      </button>
      <div className="ml-auto">
        <OverflowMenu
          label={`More actions for ${set.title}`}
          trigger={
            <span aria-hidden="true" className="text-xl leading-none">
              ⋯
            </span>
          }
          disabled={busy}
          triggerClassName={`${BUTTON_SMALL} min-w-11`}
          items={menu}
        />
      </div>
    </>
  );
}
