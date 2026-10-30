import { useLayoutEffect, useState, type ReactNode } from 'react';
import type { QuestionSet } from '../../../shared/types.js';
import { hostSet } from '../lib/hostRoom.js';
import { setDetail } from '../lib/setLabels.js';
import { BUTTON_PRIMARY, CARD } from '../lib/ui.js';
import { GameBuilder } from './GameBuilder.js';
import { RoomCreated } from './RoomCreated.js';
import { SetBrowser } from './SetBrowser.js';
import { SetPicker } from './SetPicker.js';
import { SetPreview } from './SetPreview.js';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  // `sets` lists this browser's sets, then the built-ins from index `firstBuiltIn` on.
  | { kind: 'picking'; sets: QuestionSet[]; firstBuiltIn: number; creating: boolean }
  | { kind: 'created'; code: string };

/**
 * Host a game (Creating and joining a room, steps 1–2): pick one of this browser's saved sets or a
 * built-in one (DECISIONS F54), create the room, keep its hostToken on this device, then ask where the Screen is.
 * `onOpenChange` reports when the picker or the created room is showing, so the landing page can hide the Join card
 * (DECISIONS F58). Closed, it is the landing page's Host a game card, with `children` at its foot.
 */
export function HostGame({
  onOpenChange,
  children,
}: {
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<QuestionSet | null>(null);
  const [building, setBuilding] = useState(false);
  const open = status.kind === 'picking' || status.kind === 'created';

  // Before paint, so no frame shows the picker and the Join card together.
  useLayoutEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  async function openPicker() {
    setStatus({ kind: 'loading' });
    setError(null);
    try {
      // Dexie loads only once a host opens the picker, not on every player's phone.
      const { listHostableSets } = await import('../lib/db.js');
      const { mine, builtIn } = await listHostableSets();
      const sets = [...mine, ...builtIn];
      setSelectedId(sets[0]?.id ?? null);
      setBuilding(false);
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

  if (status.kind === 'created') {
    return (
      <div className="md:col-span-2">
        <RoomCreated code={status.code} />
      </div>
    );
  }

  if (status.kind !== 'picking') {
    return (
      <section aria-labelledby="host-card-heading" className={`flex flex-col gap-4 ${CARD}`}>
        <h2 id="host-card-heading" className="font-display text-3xl">
          Host a game
        </h2>
        <p className="text-lg text-muted">Questions on the TV, buzzers on everyone&rsquo;s phone</p>
        <button
          type="button"
          onClick={() => void openPicker()}
          disabled={status.kind === 'loading'}
          className={`${BUTTON_PRIMARY} mt-auto text-2xl`}
        >
          Host a game
        </button>
        {error && (
          <p role="alert" className="text-center text-lg text-buzz">
            {error}
          </p>
        )}
        {children}
      </section>
    );
  }

  const { sets, firstBuiltIn, creating } = status;
  const builtIn = (set: QuestionSet) => sets.indexOf(set) >= firstBuiltIn;
  const selected = sets.find((set) => set.id === selectedId);

  return (
    <section
      aria-labelledby="pick-heading"
      // Behind an open preview, nothing in the picker takes focus or clicks.
      inert={previewing !== null}
      className={`flex flex-col gap-4 md:col-span-2 ${CARD}`}
    >
      {building ? (
        <>
          <h2 id="pick-heading" className="font-display text-3xl">
            Build a game
          </h2>
          <GameBuilder
            sources={sets}
            hostLabel="Host this game"
            hostingLabel="Creating room…"
            onHost={async ({ set, loadImage }) =>
              setStatus({ kind: 'created', code: await hostSet(set, loadImage) })
            }
            onSaved={(saved) => {
              // The saved game joins this browser's sets, first and picked, ready for Create room.
              setStatus({ ...status, sets: [saved, ...sets], firstBuiltIn: firstBuiltIn + 1 });
              setSelectedId(saved.id);
              setBuilding(false);
            }}
            onBack={() => setBuilding(false)}
          />
        </>
      ) : (
        <SetPicker
          heading={
            <h2 id="pick-heading" className="font-display text-3xl">
              Pick a question set
            </h2>
          }
          back={{ label: 'Back', onClick: () => setStatus({ kind: 'idle' }), disabled: creating }}
          onBuild={() => {
            setBuilding(true);
            setError(null);
          }}
          buildDisabled={creating}
          browser={
            <SetBrowser
              mode="select"
              id="host"
              legend="Question set"
              sets={sets}
              selectedId={selectedId}
              onSelect={setSelectedId}
              detail={(set) => setDetail(set, builtIn(set))}
              className="text-lg"
            />
          }
          selected={selected && { set: selected, detail: setDetail(selected, builtIn(selected)) }}
          onPreview={creating ? undefined : setPreviewing}
          message={
            error && (
              <p role="alert" className="text-center text-lg text-buzz">
                {error}
              </p>
            )
          }
          action={{
            label: creating ? 'Creating room…' : 'Create room',
            onClick: () => void create(status),
            disabled: creating || selectedId === null,
          }}
        >
          {previewing && (
            <SetPreview
              set={previewing}
              // The set is the picked one, so the preview's next step is the picker's own.
              actionLabel="Create room"
              onAction={() => void create(status)}
              onClose={() => setPreviewing(null)}
            />
          )}
        </SetPicker>
      )}
    </section>
  );
}
