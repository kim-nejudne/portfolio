import { describe, expect, it } from 'vitest';
import { createSocket } from './socket.js';

describe('createSocket', () => {
  it('uses the WebSocket transport only and waits for connect()', () => {
    const socket = createSocket('http://127.0.0.1:1');
    expect(socket.io.opts.transports).toEqual(['websocket']);
    expect(socket.connected).toBe(false);
    expect(socket.active).toBe(false);
  });
});
