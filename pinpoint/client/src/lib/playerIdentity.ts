// The `{playerKey, name, emoji}` this device joined each room with, kept in localStorage per room
// code so a refresh or a re-scan rejoins silently as the same player (spec: Reconnects). Ported
// from Sketchy (sketchy/client/src/lib/playerIdentity.ts). Storage can be unavailable (private
// mode, blocked site data), so every access is guarded.

import { EMOJI, NAME_MAX, PLAYER_KEY_LENGTH } from '#shared/constants.js';

export interface PlayerIdentity {
  playerKey: string;
  name: string;
  emoji: (typeof EMOJI)[number];
}

const KEY_PREFIX = 'pinpoint:player:';
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const KEY_PATTERN = new RegExp(`^[\\w-]{${PLAYER_KEY_LENGTH}}$`);

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** A fresh 21-character key in nanoid's alphabet; 64 symbols divide 256, so `byte & 63` is unbiased. */
export function newPlayerKey(): string {
  let key = '';
  for (const byte of crypto.getRandomValues(new Uint8Array(PLAYER_KEY_LENGTH))) {
    key += KEY_ALPHABET[byte & 63];
  }
  return key;
}

export function savePlayer(code: string, identity: PlayerIdentity): void {
  try {
    store()?.setItem(KEY_PREFIX + code, JSON.stringify(identity));
  } catch {
    // Without storage the player stays joined until the page is closed.
  }
}

/** The identity this device joined `code` with, or null when it never joined or the entry is unreadable. */
export function loadPlayer(code: string): PlayerIdentity | null {
  try {
    const raw = store()?.getItem(KEY_PREFIX + code);
    if (raw == null) return null;
    const { playerKey, name, emoji } = (JSON.parse(raw) ?? {}) as Partial<PlayerIdentity>;
    if (typeof playerKey !== 'string' || !KEY_PATTERN.test(playerKey)) return null;
    if (typeof name !== 'string' || name.trim() === '' || name.length > NAME_MAX) return null;
    if (!(EMOJI as readonly unknown[]).includes(emoji)) return null;
    return { playerKey, name, emoji: emoji! };
  } catch {
    return null;
  }
}

/** Forgets the room (the player left), so a later visit starts fresh. */
export function clearPlayer(code: string): void {
  try {
    store()?.removeItem(KEY_PREFIX + code);
  } catch {
    // Nothing stored that we can reach.
  }
}
