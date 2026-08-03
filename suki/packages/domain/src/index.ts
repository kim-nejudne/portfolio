/**
 * @suki/domain — the contract and the pure logic behind it.
 *
 * Deterministic throughout: no I/O, no clock reads, no randomness. The web app
 * imports it to render, and the sync API imports it to derive the same answers
 * server-side. A balance shown on a phone and a balance recorded on the server
 * come out of the same function, which is the only reason an offline device can
 * be trusted to be right.
 */
export * from './types';
export * from './money';
export * from './dates';
export * from './monogram';
export * from './tingi';
export * from './ledger';
