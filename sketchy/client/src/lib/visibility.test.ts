import { describe, expect, it } from 'vitest';
import { FakeSocket } from '../dev/fakeSocket.js';
import type { VisibilitySource } from './ping.js';
import type { GameSocket } from './socket.js';
import { watchVisibility } from './visibility.js';

class FakePage extends EventTarget implements VisibilitySource {
  hidden = false;
  set(hidden: boolean) {
    this.hidden = hidden;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function setup(joined = true) {
  const socket = new FakeSocket();
  const page = new FakePage();
  let isJoined = joined;
  const stop = watchVisibility(socket as unknown as GameSocket, () => isJoined, page);
  socket.connect();
  const sent = () => socket.sent('player:visibility').map((e) => e.payload);
  return { socket, page, stop, sent, join: () => (isJoined = true) };
}

describe('watchVisibility', () => {
  it('reports hidden and visible as the page changes', () => {
    const { page, sent } = setup();
    page.set(true);
    page.set(false);
    expect(sent()).toEqual([{ hidden: true }, { hidden: false }]);
  });

  it('sends nothing before the phone has joined or while offline', () => {
    const { socket, page, sent, join } = setup(false);
    page.set(true);
    join();
    socket.disconnect();
    page.set(false);
    expect(sent()).toEqual([]);
  });

  it('stop removes the listener', () => {
    const { page, stop, sent } = setup();
    stop();
    page.set(true);
    expect(sent()).toEqual([]);
  });
});
