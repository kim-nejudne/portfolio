// When **Export all** last saved a backup in this browser (Set list `/sets`), kept in localStorage.
// Storage can be unavailable (private mode, blocked site data), so every access is guarded.

const KEY = 'buzzr:lastExport';

/** The time of the last Export all, or null when this browser never made one (or can't tell). */
export function loadLastExport(): number | null {
  try {
    const stored = Number(localStorage.getItem(KEY));
    return Number.isSafeInteger(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

export function saveLastExport(at: number): void {
  try {
    localStorage.setItem(KEY, String(at));
  } catch {
    // The page still shows it until reload; nothing else to do.
  }
}
