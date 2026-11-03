import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import type { QuestionSet } from '../../../shared/types.js';
import { loadBuiltInLibrary, type BuiltInLibrary } from '../lib/builtInSets.js';
import { findPick, firstPick, pickerSections, ticketOf } from '../lib/categoryCards.js';
import { hostableRows } from '../lib/hostable.js';
import { hostSet } from '../lib/hostRoom.js';
import { setDetail } from '../lib/setLabels.js';
import { BUTTON_PRIMARY, CARD } from '../lib/ui.js';
import { BuiltInSetsError } from './BuiltInSetsError.js';
import { CategoryPicker } from './CategoryPicker.js';
import { GameBuilder } from './GameBuilder.js';
import { RoomCreated } from './RoomCreated.js';
import { SetPicker } from './SetPicker.js';
import { SetPreview } from './SetPreview.js';

/** The first built-in pick after a Retry, for a browser with no sets of its own. */
function firstBuiltInPick(library: BuiltInLibrary): string | null {
  return firstPick(pickerSections([], library.sets, {}, (set) => `built-in:${set.id}`));
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  // `builtIn` is null when the server's built-ins could not be fetched (DECISIONS F104).
  | {
      kind: 'picking';
      mine: QuestionSet[];
      builtIn: readonly QuestionSet[] | null;
      categoryEmoji: Readonly<Record<string, string>>;
      creating: boolean;
      retrying: boolean;
    }
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
  // The picked row's key (`hostableRows`): a My set and a built-in may share an id.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<QuestionSet | null>(null);
  const [building, setBuilding] = useState(false);
  const open = status.kind === 'picking' || status.kind === 'created';
  const mine = status.kind === 'picking' ? status.mine : null;
  const builtInSets = status.kind === 'picking' ? status.builtIn : null;
  const categoryEmoji = status.kind === 'picking' ? status.categoryEmoji : null;
  const rows = useMemo(() => hostableRows(mine ?? [], builtInSets), [mine, builtInSets]);
  const sections = useMemo(
    () => pickerSections(mine ?? [], builtInSets, categoryEmoji ?? {}, rows.keyOf),
    [mine, builtInSets, categoryEmoji, rows],
  );

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
      const { mine, builtIn, categoryEmoji } = await listHostableSets();
      const { keyOf } = hostableRows(mine, builtIn);
      setSelectedKey(firstPick(pickerSections(mine, builtIn, categoryEmoji, keyOf)));
      setBuilding(false);
      setStatus({
        kind: 'picking',
        mine,
        builtIn,
        categoryEmoji,
        creating: false,
        retrying: false,
      });
    } catch {
      setError('Could not load the saved sets in this browser.');
      setStatus({ kind: 'idle' });
    }
  }

  /** **Retry** after the built-ins failed to load: My sets stay listed meanwhile. */
  function retryBuiltIns() {
    const picking = (retrying: boolean, library?: BuiltInLibrary) =>
      setStatus((current) =>
        current.kind === 'picking'
          ? {
              ...current,
              retrying,
              builtIn: library?.sets ?? current.builtIn,
              categoryEmoji: library?.categoryEmoji ?? current.categoryEmoji,
            }
          : current,
      );
    picking(true);
    loadBuiltInLibrary().then(
      (library) => {
        picking(false, library);
        // A browser with no sets of its own now has something picked, as on opening.
        setSelectedKey((key) => key ?? firstBuiltInPick(library));
      },
      () => picking(false),
    );
  }

  async function create(picking: Extract<Status, { kind: 'picking' }>) {
    const set = rows.sets.find((s) => rows.keyOf(s) === selectedKey);
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

  const { creating } = status;
  const { sets } = rows;
  const pick = findPick(sections, selectedKey);

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
              setStatus({ ...status, mine: [saved, ...status.mine] });
              setSelectedKey(`mine:${saved.id}`);
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
          browser={
            <CategoryPicker
              id="host"
              sections={sections}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              detail={(set) => setDetail(set, false)}
              onBuild={() => {
                setBuilding(true);
                setError(null);
              }}
              buildDisabled={creating}
              builtInError={
                status.builtIn === null && (
                  <BuiltInSetsError onRetry={retryBuiltIns} retrying={status.retrying} />
                )
              }
            />
          }
          selected={pick && { set: pick.set, ticket: ticketOf(pick) }}
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
            disabled: creating || pick === undefined,
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
