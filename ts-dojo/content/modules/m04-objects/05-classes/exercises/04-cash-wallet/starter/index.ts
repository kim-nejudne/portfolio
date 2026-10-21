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
  owner: string;

  constructor(owner: string) {
    this.owner = owner;
  }

  balance(): number {
    throw new Error(`not implemented for ${this.owner}`);
  }

  deposit(amount: number): Result {
    throw new Error(`not implemented for ${amount}`);
  }

  withdraw(amount: number): Result {
    throw new Error(`not implemented for ${amount}`);
  }
}

/** Moves `amount` from one wallet to the other; returns the result of the withdrawal. */
export function transfer(from: Wallet, to: Wallet, amount: number): Result {
  throw new Error(
    `not implemented for ${amount} from ${from.owner} to ${to.owner}`,
  );
}
