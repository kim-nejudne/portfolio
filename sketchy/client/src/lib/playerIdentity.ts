// The `{playerKey, name}` this device joined each room with, kept in localStorage per room code so
// a refresh or a re-scan rejoins silently as the same player (Creating and joining a room, step 4).
// Ported from Buzzr (buzzer/client/src/lib/playerIdentity.ts), without nanoid or zod: the key comes
// from `crypto.getRandomValues` and the stored entry is checked by hand. Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.

import { PLAYER_KEY_LENGTH, PLAYER_NAME_MAX } from '../../../shared/constants.js';

export interface PlayerIdentity {
  playerKey: string;
  name: string;
}

const KEY_PREFIX = 'sketchy:player:';
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const KEY_PATTERN = new RegExp(`^[\\w-]{${PLAYER_KEY_LENGTH}}$`);

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** `localStorage`, or null where reading it throws (blocked site data) or it doesn't exist. */
function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * A fresh 21-character key in nanoid's alphabet. 64 symbols divide 256, so `byte & 63` is unbiased.
 * `crypto.getRandomValues` works on plain-http LAN pages too (`randomUUID` does not).
 */
export function newPlayerKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PLAYER_KEY_LENGTH));
  let key = '';
  for (const byte of bytes) key += KEY_ALPHABET[byte & 63];
  return key;
}

export function savePlayer(
  code: string,
  identity: PlayerIdentity,
  store: KeyValueStore | null = defaultStore(),
): void {
  try {
    store?.setItem(KEY_PREFIX + code, JSON.stringify(identity));
  } catch {
    // Without storage the player stays joined until the page is closed; nothing else to do.
  }
}

/** The identity this device joined `code` with, or null when it never joined or the entry is unreadable. */
export function loadPlayer(
  code: string,
  store: KeyValueStore | null = defaultStore(),
): PlayerIdentity | null {
  try {
    const raw = store?.getItem(KEY_PREFIX + code);
    if (raw == null) return null;
    const data = JSON.parse(raw) as Partial<PlayerIdentity> | null;
    const { playerKey, name } = data ?? {};
    if (typeof playerKey !== 'string' || !KEY_PATTERN.test(playerKey)) return null;
    if (typeof name !== 'string' || name.trim() === '' || name.length > PLAYER_NAME_MAX)
      return null;
    return { playerKey, name };
  } catch {
    return null;
  }
}

/** Forgets the room (the player left, was removed, or the game is over), so a later visit starts fresh. */
export function clearPlayer(code: string, store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.removeItem(KEY_PREFIX + code);
  } catch {
    // Nothing stored that we can reach.
  }
}
