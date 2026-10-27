import { useState } from 'react';
import { Link } from 'react-router';
import type { QuestionSet } from '../../../shared/types.js';
import { hostSet } from '../lib/hostRoom.js';
import { questionCount } from '../lib/setLabels.js';
import { RoomCreated } from './RoomCreated.js';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'picking'; sets: QuestionSet[]; creating: boolean }
  | { kind: 'created'; code: string };

const bigButton =
  'rounded-3xl px-6 py-6 font-display text-3xl transition active:scale-95 disabled:opacity-40';

/**
 * Host a game (Creating and joining a room, steps 1–2): pick one of this browser's saved sets,
 * create the room, keep its hostToken on this device, then ask where the Screen is.
 */
export function HostGame() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openPicker() {
    setStatus({ kind: 'loading' });
    setError(null);
    try {
      // Dexie loads only once a host opens the picker, not on every player's phone.
      const { listSets } = await import('../lib/db.js');
      const sets = await listSets();
      setSelectedId(sets[0]?.id ?? null);
      setStatus({ kind: 'picking', sets, creating: false });
    } catch {
      setError('Could not load the saved sets in this browser.');
      setStatus({ kind: 'idle' });
    }
  }

  async function create(sets: QuestionSet[]) {
    const set = sets.find((s) => s.id === selectedId);
    if (!set) return;
    setStatus({ kind: 'picking', sets, creating: true });
    setError(null);
    try {
      setStatus({ kind: 'created', code: await hostSet(set) });
    } catch (caught) {
      setError((caught as Error).message);
      setStatus({ kind: 'picking', sets, creating: false });
    }
  }

  if (status.kind === 'created') return <RoomCreated code={status.code} />;

  if (status.kind !== 'picking') {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void openPicker()}
          disabled={status.kind === 'loading'}
          className={`${bigButton} border-2 border-accent text-accent`}
        >
          Host a game
        </button>
        {error && (
          <p role="alert" className="text-center text-lg text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  const { sets, creating } = status;

  return (
    <section
      aria-labelledby="pick-heading"
      className="flex flex-col gap-4 rounded-3xl border-2 border-accent bg-surface p-6"
    >
      <h2 id="pick-heading" className="font-display text-3xl">
        Pick a question set
      </h2>
      {sets.length === 0 ? (
        <p className="text-lg text-muted">
          No saved sets yet.{' '}
          <Link to="/sets" className="text-ink underline underline-offset-4">
            Make one in My question sets
          </Link>
          .
        </p>
      ) : (
        <fieldset className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          <legend className="sr-only">Question set</legend>
          {sets.map((set) => (
            <label
              key={set.id}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-edge bg-bg px-4 py-3 has-checked:border-accent"
            >
              <input
                type="radio"
                name="host-set"
                value={set.id}
                checked={selectedId === set.id}
                onChange={() => setSelectedId(set.id)}
                className="size-5 accent-accent"
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-lg">{set.title}</span>
                <span className="text-sm text-muted">{questionCount(set.questions.length)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <button
        type="button"
        onClick={() => void create(sets)}
        disabled={creating || selectedId === null}
        className={`${bigButton} bg-accent text-2xl text-accent-ink`}
      >
        {creating ? 'Creating room…' : 'Create room'}
      </button>
      {error && (
        <p role="alert" className="text-center text-lg text-red-400">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => setStatus({ kind: 'idle' })}
        disabled={creating}
        className="text-lg text-muted underline underline-offset-4 hover:text-ink"
      >
        Cancel
      </button>
    </section>
  );
}
