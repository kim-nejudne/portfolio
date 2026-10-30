import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInkSocket, createSocket, TRANSPORT_OPTIONS } from './socket.js';

let http: HttpServer | undefined;
let client: Socket | undefined;

afterEach(async () => {
  client?.close();
  client = undefined;
  vi.unstubAllGlobals();
  if (http) await new Promise((resolve) => http!.close(resolve));
  http = undefined;
});

/** A Socket.IO server that accepts only `transports`, like a network that blocks one of them. */
async function serve(transports: ('websocket' | 'polling')[]): Promise<string> {
  http = createServer();
  new Server(http, { transports });
  http.listen(0);
  await new Promise((resolve) => http!.once('listening', resolve));
  return `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
}

async function connectedTransport(url: string): Promise<string> {
  client = io(url, { ...TRANSPORT_OPTIONS, forceNew: true, reconnection: false });
  await new Promise<void>((resolve, reject) => {
    client!.once('connect', () => resolve());
    client!.once('connect_error', reject);
  });
  return client.io.engine.transport.name;
}

describe('transport (spec: Performance budget)', () => {
  it('opens a WebSocket first', async () => {
    expect(await connectedTransport(await serve(['websocket', 'polling']))).toBe('websocket');
  });

  it('falls back to long-polling when the WebSocket fails', async () => {
    expect(await connectedTransport(await serve(['polling']))).toBe('polling');
  });

  it('is what both namespaces use', () => {
    vi.stubGlobal('location', new URL('http://localhost:3000/play/ABCD'));
    for (const socket of [createSocket(), createInkSocket()]) {
      expect(socket.io.opts).toMatchObject({
        transports: ['websocket', 'polling'],
        tryAllTransports: true,
      });
      socket.close();
    }
  });
});
