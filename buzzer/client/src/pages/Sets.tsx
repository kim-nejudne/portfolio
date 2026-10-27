import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { QuestionSet } from '../../../shared/types.js';
import { ConfirmButton } from '../components/ConfirmButton.js';
import { RoomCreated } from '../components/RoomCreated.js';
import { createSet, deleteSet, duplicateSet, listSets } from '../lib/db.js';
import { hostSet } from '../lib/hostRoom.js';
import { formatEdited, questionCount } from '../lib/setLabels.js';

const LOAD_ERROR = 'Could not load the saved sets in this browser.';

const smallButton =
  'rounded-xl border-2 border-edge px-3 py-2 text-base transition active:scale-95 disabled:opacity-40';

/** Set list `/sets`: this browser's saved question sets, last edited first. */
export function Sets() {
  const navigate = useNavigate();
  const [sets, setSets] = useState<QuestionSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hostedCode, setHostedCode] = useState<string | null>(null);

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
      (loaded) => live && setSets(loaded),
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
  const remove = (id: string) =>
    act(async () => {
      await deleteSet(id);
      await reload();
    });
  const host = (set: QuestionSet) =>
    act(async () => {
      setHostedCode(await hostSet(set));
    });

  if (hostedCode !== null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
        <RoomCreated code={hostedCode} />
        <button
          type="button"
          onClick={() => setHostedCode(null)}
          className="text-lg text-muted underline underline-offset-4 hover:text-ink"
        >
          Back to my sets
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl text-accent">My question sets</h1>
        <button
          type="button"
          onClick={() => void newSet()}
          disabled={busy || sets === null}
          className="rounded-2xl bg-accent px-5 py-3 font-display text-xl text-accent-ink transition active:scale-95 disabled:opacity-40"
        >
          New set
        </button>
      </div>

      {error && (
        <p role="alert" className="text-lg text-red-400">
          {error}
        </p>
      )}

      {sets === null ? (
        error === null && <p className="text-muted">Loading…</p>
      ) : sets.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-edge p-8 text-center text-lg text-muted">
          No question sets yet. Tap <strong className="text-ink">New set</strong> to write one.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {sets.map((set) => (
            <li
              key={set.id}
              aria-labelledby={`set-${set.id}`}
              className="flex flex-col gap-3 rounded-3xl border-2 border-edge bg-surface p-5"
            >
              <div className="min-w-0">
                <h2 id={`set-${set.id}`} className="truncate font-display text-2xl">
                  {set.title}
                </h2>
                <p className="text-muted">
                  {questionCount(set.questions.length)} · Last edited{' '}
                  <time dateTime={new Date(set.updatedAt).toISOString()}>
                    {formatEdited(set.updatedAt)}
                  </time>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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
              </div>
            </li>
          ))}
        </ul>
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
