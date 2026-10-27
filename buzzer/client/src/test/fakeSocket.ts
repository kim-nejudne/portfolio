import { act } from '@testing-library/react';
import type { Ack } from '../../../shared/types.js';

/** Just enough of a Socket.IO client: records emits and lets the test fire server events. */
export class FakeSocket {
  private handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  emitted: { event: string; payload: unknown; ack: (res: Ack) => void }[] = [];
  disconnected = false;

  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  emit(event: string, payload: unknown, ack: (res: Ack) => void) {
    this.emitted.push({ event, payload, ack });
    return this;
  }

  connect() {
    this.fire('connect');
    return this;
  }

  disconnect() {
    this.disconnected = true;
    return this;
  }

  fire(event: string, ...args: unknown[]) {
    act(() => {
      for (const handler of this.handlers.get(event) ?? []) handler(...args);
    });
  }
}
