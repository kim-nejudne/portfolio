export type Result =
  | { ok: true; balance: number }
  | { ok: false; reason: 'invalid-amount' | 'insufficient-funds' };

export interface Wallet {
  readonly owner: string;
  balance(): number;
  deposit(amount: number): Result;
  withdraw(amount: number): Result;
}

export class CashWallet implements Wallet {
  readonly owner: string;
  #cents = 0;

  constructor(owner: string) {
    this.owner = owner;
  }

  balance(): number {
    return this.#cents;
  }

  deposit(amount: number): Result {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, reason: 'invalid-amount' };
    }
    this.#cents += amount;
    return { ok: true, balance: this.#cents };
  }

  withdraw(amount: number): Result {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, reason: 'invalid-amount' };
    }
    if (amount > this.#cents) {
      return { ok: false, reason: 'insufficient-funds' };
    }
    this.#cents -= amount;
    return { ok: true, balance: this.#cents };
  }
}

/** Moves `amount` from one wallet to the other; returns the result of the withdrawal. */
export function transfer(from: Wallet, to: Wallet, amount: number): Result {
  const result = from.withdraw(amount);
  if (result.ok) {
    to.deposit(amount);
  }
  return result;
}
