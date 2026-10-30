// The hostToken for each room this device created, kept in localStorage (Creating and joining a
// room, step 1). Ported from Buzzr (buzzer/client/src/lib/hostTokens.ts). Storage can be
// unavailable (private mode, blocked site data), so every access is guarded.

const KEY_PREFIX = 'sketchy:hostToken:';

export function saveHostToken(code: string, hostToken: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + code, hostToken);
  } catch {
    // Without storage this Screen still hosts until the page is closed.
  }
}

/** The stored token for `code`, or null when this device did not create that room. */
export function loadHostToken(code: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + code);
  } catch {
    return null;
  }
}

/** Forgets a token the server refused, e.g. one left from an expired room with the same code. */
export function clearHostToken(code: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + code);
  } catch {
    // Nothing stored that we can reach.
  }
}
