import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { Link, useNavigate } from 'react-router';
import { BUILT_IN_SETS } from '../../../shared/builtInSets.js';
import type { QuestionSet } from '../../../shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { RoomCreated } from '../components/RoomCreated.js';
import { SetBrowser } from '../components/SetBrowser.js';
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
import { hostSet } from '../lib/hostRoom.js';
import {
  exportFileName,
  exportSetFile,
  IMPORT_FILE_MAX_BYTES,
  parseSetFile,
} from '../lib/importExport.js';
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

type Tab = 'builtIn' | 'mine';

const TABS: { id: Tab; label: string }[] = [
  { id: 'builtIn', label: 'Built-in' },
  { id: 'mine', label: 'My sets' },
];

/** The tab a visit opens on: My sets once this browser has a set, else the built-in library. */
function firstTab(mine: readonly QuestionSet[]): Tab {
  return mine.length > 0 ? 'mine' : 'builtIn';
}

const smallButton = `min-h-11 rounded-xl border-2 border-edge bg-surface px-3 py-2 text-base font-bold transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`;

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
  const [importErrors, setImportErrors] = useState<{ file: string; errors: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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
  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared, so choosing the same file again after a fix still fires `change`.
    event.target.value = '';
    if (!file) return;
    void act(async () => {
      if (file.size > IMPORT_FILE_MAX_BYTES) {
        const limit = Math.round(IMPORT_FILE_MAX_BYTES / 1024 / 1024);
        setImportErrors({ file: file.name, errors: [`The file is larger than ${limit} MB.`] });
        return;
      }
      const parsed = parseSetFile(await file.text());
      if (!parsed.ok) {
        setImportErrors({ file: file.name, errors: parsed.errors });
        return;
      }
      const imported = await importSet(parsed.set, parsed.images);
      setNotice(`Imported “${imported.title}”.`);
      await reload();
      setTab('mine');
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
        <button
          type="button"
          onClick={() => setHostedCode(null)}
          className="text-lg text-muted underline underline-offset-4 hover:text-ink"
        >
          Back to question sets
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl text-accent">Question sets</h1>
        <div className="flex flex-wrap gap-2">
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

      {error && (
        <p role="alert" className="text-lg text-buzz">
          {error}
        </p>
      )}

      {importErrors && (
        <div role="alert" className="flex flex-col gap-2 text-lg text-buzz">
          <p>Couldn't import {importErrors.file}:</p>
          <ul className="list-disc pl-6">
            {importErrors.errors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {sets === null ? (
        error === null && <p className="text-muted">Loading…</p>
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
                actions={(set) => (
                  <>
                    <button
                      type="button"
                      onClick={() => void duplicateToMine(set.id)}
                      disabled={busy}
                      className={smallButton}
                    >
                      Duplicate to My sets
                    </button>
                    <button
                      type="button"
                      onClick={() => void host(set)}
                      disabled={busy}
                      className={`${smallButton} border-accent text-accent`}
                    >
                      Host this set
                    </button>
                  </>
                )}
              />
            ) : sets.length === 0 ? (
              <p className="rounded-[20px] border-2 border-dashed border-edge p-8 text-center text-lg text-muted">
                No question sets yet. Tap <strong className="text-ink">New set</strong> to write
                one, or duplicate a built-in set.
              </p>
            ) : (
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
                actions={(set) => (
                  <>
                    <Link to={`/sets/${set.id}`} className={smallButton}>
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => void duplicate(set.id)}
                      disabled={busy}
                      className={smallButton}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportSet(set)}
                      disabled={busy}
                      className={smallButton}
                    >
                      Export JSON
                    </button>
                    <ConfirmButton
                      label="Delete"
                      confirmLabel="Confirm delete"
                      onConfirm={() => void remove(set.id)}
                      disabled={busy}
                      className={smallButton}
                    />
                    <button
                      type="button"
                      onClick={() => void host(set)}
                      disabled={busy}
                      className={`${smallButton} border-accent text-accent`}
                    >
                      Host this set
                    </button>
                  </>
                )}
              />
            )}
          </div>
        </div>
      )}

      <Link
        to="/"
        className="text-center text-lg text-muted underline underline-offset-4 hover:text-ink"
      >
        Back to start
      </Link>
    </main>
  );
}
