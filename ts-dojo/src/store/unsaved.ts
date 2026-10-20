// The unsaved-text journal behind §12 F8 "restored on return, including after a reload
// mid-edit": autosave writes 500 ms after the last keystroke (§7) into IndexedDB, whose writes
// are asynchronous and are lost when the page unloads inside that window. So on `pagehide` the
// lesson page also writes the texts still waiting here, synchronously, in localStorage under
// one key (exercise id → path → text); the exercise reads them back over its stored files on
// its next mount, saves them to IndexedDB and drops them. Not a second store: it only ever
// holds what the last unload interrupted (Spec questions in docs/progress.md).
export const UNSAVED_KEY = 'ts-dojo:unsaved';

export type UnsavedStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>;

type Journal = Record<string, Record<string, string>>;

function read(storage: UnsavedStorage | null): Journal {
  try {
    const raw = storage?.getItem(UNSAVED_KEY) ?? null;
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Journal)
      : {};
  } catch {
    return {};
  }
}

function write(storage: UnsavedStorage | null, journal: Journal): void {
  try {
    if (Object.keys(journal).length === 0) storage?.removeItem(UNSAVED_KEY);
    else storage?.setItem(UNSAVED_KEY, JSON.stringify(journal));
  } catch {
    // Blocked storage: the autosave's own write is all there is.
  }
}

/** `window.localStorage`, or null when it throws. */
export function unsavedStorage(): UnsavedStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** On `pagehide`: the texts the autosave has not written yet. */
export function journalUnsaved(
  exerciseId: string,
  files: Readonly<Record<string, string>>,
  storage: UnsavedStorage | null = unsavedStorage(),
): void {
  if (Object.keys(files).length === 0) return;
  const journal = read(storage);
  journal[exerciseId] = { ...journal[exerciseId], ...files };
  write(storage, journal);
}

/** The interrupted texts of one exercise (path → text); `{}` when there are none. */
export function peekUnsaved(
  exerciseId: string,
  storage: UnsavedStorage | null = unsavedStorage(),
): Record<string, string> {
  return read(storage)[exerciseId] ?? {};
}

/** Once the texts are saved in IndexedDB. */
export function dropUnsaved(
  exerciseId: string,
  storage: UnsavedStorage | null = unsavedStorage(),
): void {
  const journal = read(storage);
  if (!(exerciseId in journal)) return;
  delete journal[exerciseId];
  write(storage, journal);
}
