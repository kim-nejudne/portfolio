// The playerId and name this device joined each room with, kept in localStorage so a refresh
// rejoins as the same player (Reconnection and state recovery). Storage can be unavailable
// (private mode, blocked site data), so every access is guarded.

import { nanoid } from 'nanoid';
import { z } from 'zod';
import { idSchema, playerNameSchema } from '../../../shared/schemas.js';

const KEY_PREFIX = 'buzzr:player:';

const identitySchema = z.object({ playerId: idSchema, name: playerNameSchema });

export type PlayerIdentity = z.infer<typeof identitySchema>;

/** A fresh playerId. nanoid uses `crypto.getRandomValues`, which works on plain-http LAN pages too. */
export function newPlayerId(): string {
  return nanoid();
}

export function savePlayer(code: string, identity: PlayerIdentity): void {
  try {
    localStorage.setItem(KEY_PREFIX + code, JSON.stringify(identity));
  } catch {
    // Without storage the player stays joined until the page is closed; nothing else to do.
  }
}

/** The identity this device joined `code` with, or null when it never joined or the entry is unreadable. */
export function loadPlayer(code: string): PlayerIdentity | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + code);
    if (raw === null) return null;
    const parsed = identitySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Forgets the identity for a room that no longer exists, so a later room with the same code starts fresh. */
export function clearPlayer(code: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + code);
  } catch {
    // Nothing stored that we can reach.
  }
}
