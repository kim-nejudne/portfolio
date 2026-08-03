/**
 * @forme/domain — the contract and the pure logic behind it.
 *
 * Everything here is deterministic: no I/O, no clock reads, no randomness. The
 * API imports it to compute authoritative prices, plans and transitions; the web
 * app imports it to render the same numbers without a round trip. That is the
 * point — a price quoted on the marketing page and a price charged by the API
 * come out of the same function.
 */
export * from './types';
export * from './money';
export * from './dates';
export * from './vocabulary';
export * from './state-machine';
export * from './quote';
export * from './imposition';
export * from './preflight';
export * from './job';
