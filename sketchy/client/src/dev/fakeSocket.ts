// Just enough of a Socket.IO client for the bot tests: records emits (with their acks) and lets a
// test fire server events. Adapted from Buzzr (buzzer/client/src/test/fakeSocket.ts), without
// React's `act`: the bots have no React state.

import type { Ack } from '../../../shared/types.js';

export class FakeSocket {
  private handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  emitted: { event: string; payload: unknown; ack?: (res: Ack) => void }[] = [];
  connected = false;
  disconnected = false;
  auth: unknown;

  constructor(auth?: unknown) {
    this.auth = auth;
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  off(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(
      event,
      (this.handlers.get(event) ?? []).filter((h) => h !== handler),
    );
    return this;
  }

  emit(event: string, payload: unknown, ack?: (res: Ack) => void) {
    this.emitted.push({ event, payload, ack });
    return this;
  }

  connect() {
    this.connected = true;
    this.disconnected = false;
    this.fire('connect');
    return this;
  }

  disconnect() {
    this.connected = false;
    this.disconnected = true;
    return this;
  }

  removeAllListeners() {
    this.handlers.clear();
    return this;
  }

  fire(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }

  /** The emits of one event, oldest first. */
  sent(event: string) {
    return this.emitted.filter((e) => e.event === event);
  }
}
