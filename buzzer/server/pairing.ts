import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
  PAIRING_PIN_LENGTH,
  PAIRING_PIN_MAX_MISSES,
  PAIRING_PIN_TTL_MS,
} from '../shared/constants.js';

/** One room's live PIN. Only a salted hash of the PIN is kept. */
interface Pairing {
  salt: Buffer;
  pinHash: Buffer;
  /**
   * The token the host presented when asking for the PIN, handed back on a match. The room keeps only
   * the token's hash, so it cannot be rebuilt later; this copy lives no longer than the PIN.
   */
  hostToken: string;
  expiresAt: number;
  misses: number;
  /** Drops this pairing after its TTL even if nobody asks again, so the token copy never lingers. */
  timer: ReturnType<typeof setTimeout>;
}

export type RedeemResult = { ok: true; hostToken: string } | { ok: false };

function hashPin(salt: Buffer, pin: string): Buffer {
  return createHash('sha256').update(salt).update(pin, 'utf8').digest();
}

/**
 * Pairing PINs (Creating and joining a room, step 3; F70): one per room, `PAIRING_PIN_LENGTH`
 * digits, valid for `PAIRING_PIN_TTL_MS`, used once, and revoked after `PAIRING_PIN_MAX_MISSES`
 * wrong guesses. A new PIN for a room replaces the old one. Kept outside `Room`, so no view or
 * reducer ever sees it.
 */
export class PairingStore {
  private readonly pairings = new Map<string, Pairing>();

  constructor(private readonly drawPin: () => string = randomPin) {}

  /** A fresh PIN for `code`, redeemable for `hostToken` until `now + PAIRING_PIN_TTL_MS`. */
  create(code: string, hostToken: string, now: number): string {
    this.sweep(now);
    const pin = this.drawPin();
    const salt = randomBytes(16);
    this.delete(code);
    const pairing: Pairing = {
      salt,
      pinHash: hashPin(salt, pin),
      hostToken,
      expiresAt: now + PAIRING_PIN_TTL_MS,
      misses: 0,
      timer: setTimeout(() => {
        if (this.pairings.get(code) === pairing) this.pairings.delete(code);
      }, PAIRING_PIN_TTL_MS),
    };
    // Validity still follows `now`; the timer only frees memory, and never keeps the process alive.
    pairing.timer.unref();
    this.pairings.set(code, pairing);
    return pin;
  }

  /** The room's token for the right PIN, once. A wrong guess counts towards revoking the PIN. */
  redeem(code: string, pin: string, now: number): RedeemResult {
    this.sweep(now);
    const pairing = this.pairings.get(code);
    if (!pairing) return { ok: false };
    const candidate = hashPin(pairing.salt, pin);
    if (timingSafeEqual(candidate, pairing.pinHash)) {
      this.delete(code);
      return { ok: true, hostToken: pairing.hostToken };
    }
    pairing.misses += 1;
    if (pairing.misses >= PAIRING_PIN_MAX_MISSES) this.delete(code);
    return { ok: false };
  }

  get size(): number {
    return this.pairings.size;
  }

  /** Drops every expired PIN. */
  private sweep(now: number): void {
    for (const [code, pairing] of this.pairings) {
      if (now >= pairing.expiresAt) this.delete(code);
    }
  }

  private delete(code: string): void {
    const pairing = this.pairings.get(code);
    if (!pairing) return;
    clearTimeout(pairing.timer);
    this.pairings.delete(code);
  }
}

/** `PAIRING_PIN_LENGTH` digits from the CSPRNG, leading zeros kept. */
export function randomPin(): string {
  return String(randomInt(10 ** PAIRING_PIN_LENGTH)).padStart(PAIRING_PIN_LENGTH, '0');
}
