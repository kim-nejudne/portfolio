import { CashWallet, transfer, type Result, type Wallet } from './index';

const fake = {
  owner: 'Eve',
  balance: () => 1_000_000,
  deposit: (amount: number): Result => ({ ok: true, balance: amount }),
  withdraw: (amount: number): Result => ({ ok: true, balance: amount }),
};

const anyWallet: Wallet = fake; // any object with the methods is a Wallet

// @ts-expect-error
const forged: CashWallet = fake; // a plain object is not a CashWallet

// @ts-expect-error
const rename = (wallet: CashWallet) => (wallet.owner = 'Eve'); // the owner is readonly

export { anyWallet, forged, rename };

test('a new wallet has its owner and a balance of 0', () => {
  const wallet = new CashWallet('Ada');
  expect(wallet.owner).toBe('Ada');
  expect(wallet.balance()).toBe(0);
});

test('deposit adds to the balance and returns it', () => {
  const wallet = new CashWallet('Ada');
  expect(wallet.deposit(500)).toEqual({ ok: true, balance: 500 });
  expect(wallet.deposit(250)).toEqual({ ok: true, balance: 750 });
  expect(wallet.balance()).toBe(750);
});

test('withdraw takes from the balance and returns it', () => {
  const wallet = new CashWallet('Ada');
  wallet.deposit(500);
  expect(wallet.withdraw(200)).toEqual({ ok: true, balance: 300 });
  expect(wallet.withdraw(300)).toEqual({ ok: true, balance: 0 });
});

test('an amount that is not a positive whole number is invalid', () => {
  const wallet = new CashWallet('Ada');
  const invalid = { ok: false, reason: 'invalid-amount' };
  expect(wallet.deposit(0)).toEqual(invalid);
  expect(wallet.deposit(-5)).toEqual(invalid);
  expect(wallet.deposit(2.5)).toEqual(invalid);
  expect(wallet.deposit(Number.NaN)).toEqual(invalid);
  expect(wallet.withdraw(-5)).toEqual(invalid);
  expect(wallet.balance()).toBe(0);
});

test('withdrawing more than the balance fails and changes nothing', () => {
  const wallet = new CashWallet('Ada');
  wallet.deposit(100);
  expect(wallet.withdraw(101)).toEqual({
    ok: false,
    reason: 'insufficient-funds',
  });
  expect(wallet.balance()).toBe(100);
});

test('the amount is checked before the balance', () => {
  const wallet = new CashWallet('Ada');
  expect(wallet.withdraw(1.5)).toEqual({ ok: false, reason: 'invalid-amount' });
});

test('the balance is not a property of the wallet', () => {
  const wallet = new CashWallet('Ada');
  wallet.deposit(4321);
  expect(JSON.stringify(wallet)).not.toContain('4321');
  expect(JSON.stringify(wallet)).toContain('Ada');
  expect(Object.values(wallet)).not.toContain(4321);
});

test('transfer moves the amount and returns the withdrawal', () => {
  const ada = new CashWallet('Ada');
  const bob = new CashWallet('Bob');
  ada.deposit(100);
  expect(transfer(ada, bob, 40)).toEqual({ ok: true, balance: 60 });
  expect(ada.balance()).toBe(60);
  expect(bob.balance()).toBe(40);
});

test('a failed transfer moves nothing', () => {
  const ada = new CashWallet('Ada');
  const bob = new CashWallet('Bob');
  ada.deposit(100);
  expect(transfer(ada, bob, 150)).toEqual({
    ok: false,
    reason: 'insufficient-funds',
  });
  expect(transfer(ada, bob, -1)).toEqual({
    ok: false,
    reason: 'invalid-amount',
  });
  expect(ada.balance()).toBe(100);
  expect(bob.balance()).toBe(0);
});

test('transfer works with any Wallet', () => {
  const deposits: number[] = [];
  const jar: Wallet = {
    owner: 'Jar',
    balance: () => 0,
    deposit: (amount) => {
      deposits.push(amount);
      return { ok: true, balance: amount };
    },
    withdraw: () => ({ ok: false, reason: 'insufficient-funds' }),
  };
  const ada = new CashWallet('Ada');
  ada.deposit(100);
  expect(transfer(ada, jar, 30)).toEqual({ ok: true, balance: 70 });
  expect(deposits).toEqual([30]);
  expect(transfer(jar, ada, 10)).toEqual({
    ok: false,
    reason: 'insufficient-funds',
  });
  expect(ada.balance()).toBe(70);
});
