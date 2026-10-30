// Which layout the host remote shows for each room in this tab: normal or read-aloud (F69). Kept in
// sessionStorage, so it survives a reload but a new tab starts normal. Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.

const KEY_PREFIX = 'buzzr:readAloud:';

/** True when this tab last chose the read-aloud layout for `code`. */
export function loadReadAloud(code: string): boolean {
  try {
    return sessionStorage.getItem(KEY_PREFIX + code) === '1';
  } catch {
    return false;
  }
}

export function saveReadAloud(code: string, on: boolean): void {
  try {
    if (on) sessionStorage.setItem(KEY_PREFIX + code, '1');
    else sessionStorage.removeItem(KEY_PREFIX + code);
  } catch {
    // Without storage the layout still applies until the page is closed; nothing else to do.
  }
}

/** The search param `RoomCreated`'s **Phone only** opens the remote with. */
export const READ_ALOUD_PARAM = 'read';

/** True when `search` asks for the read-aloud layout (`?read=1`). */
export function readAloudRequested(search: string): boolean {
  return new URLSearchParams(search).get(READ_ALOUD_PARAM) === '1';
}

/** `search` without the read-aloud param, for the address bar once the choice is stored. */
export function withoutReadAloud(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(READ_ALOUD_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}
