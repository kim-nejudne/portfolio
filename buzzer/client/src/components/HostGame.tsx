import { useEffect, useRef, useState } from 'react';
import type { QuestionSet } from '../../../shared/types.js';
import { hostSet } from '../lib/hostRoom.js';
import { setDetail } from '../lib/setLabels.js';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, CARD } from '../lib/ui.js';
import { RoomCreated } from './RoomCreated.js';
import { SetBrowser } from './SetBrowser.js';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  // `sets` lists this browser's sets, then the built-ins from index `firstBuiltIn` on.
  | { kind: 'picking'; sets: QuestionSet[]; firstBuiltIn: number; creating: boolean }
  | { kind: 'created'; code: string };

/**
 * Host a game (Creating and joining a room, steps 1–2): pick one of this browser's saved sets or a
 * built-in one (DECISIONS F54), create the room, keep its hostToken on this device, then ask where the Screen is.
 */
export function HostGame() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLElement>(null);
  const picking = status.kind === 'picking';

  // The picker opens under the Join card: bring its search box and chips into view (DECISIONS F55).
  useEffect(() => {
    if (picking) pickerRef.current?.scrollIntoView({ block: 'start' });
  }, [picking]);

  async function openPicker() {
    setStatus({ kind: 'loading' });
    setError(null);
    try {
      // Dexie loads only once a host opens the picker, not on every player's phone.
      const { listHostableSets } = await import('../lib/db.js');
      const { mine, builtIn } = await listHostableSets();
      const sets = [...mine, ...builtIn];
      setSelectedId(sets[0]?.id ?? null);
      setStatus({ kind: 'picking', sets, firstBuiltIn: mine.length, creating: false });
    } catch {
      setError('Could not load the saved sets in this browser.');
      setStatus({ kind: 'idle' });
    }
  }

  async function create(picking: Extract<Status, { kind: 'picking' }>) {
    const set = picking.sets.find((s) => s.id === selectedId);
    if (!set) return;
    setStatus({ ...picking, creating: true });
    setError(null);
    try {
      setStatus({ kind: 'created', code: await hostSet(set) });
    } catch (caught) {
      setError((caught as Error).message);
      setStatus({ ...picking, creating: false });
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
          className={`${BUTTON_OUTLINE} py-5 text-2xl`}
        >
          Host a game
        </button>
        {error && (
          <p role="alert" className="text-center text-lg text-buzz">
            {error}
          </p>
        )}
      </div>
    );
  }

  const { sets, firstBuiltIn, creating } = status;

  return (
    <section
      ref={pickerRef}
      aria-labelledby="pick-heading"
      className={`flex flex-col gap-4 ${CARD}`}
    >
      <h2 id="pick-heading" className="font-display text-3xl">
        Pick a question set
      </h2>
      <SetBrowser
        mode="select"
        id="host"
        legend="Question set"
        sets={sets}
        selectedId={selectedId}
        onSelect={setSelectedId}
        detail={(set) => setDetail(set, sets.indexOf(set) >= firstBuiltIn)}
        listClassName="max-h-80 overflow-y-auto"
        className="text-lg"
      />
      <button
        type="button"
        onClick={() => void create(status)}
        disabled={creating || selectedId === null}
        className={`${BUTTON_PRIMARY} py-5 text-2xl`}
      >
        {creating ? 'Creating room…' : 'Create room'}
      </button>
      {error && (
        <p role="alert" className="text-center text-lg text-buzz">
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
