// The smoke check (F51) against an in-process server wired as `server/index.ts` wires it, with a
// stand-in client build, so the checks the container and the live URL rely on stay true.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/http.js';
import { attachInkGateway } from '../server/inkGateway.js';
import { InMemoryRoomStore } from '../server/roomStore.js';
import { attachSockets } from '../server/sockets.js';
import { TEST_PACKS } from '../server/test/packs.js';
import { runSmoke } from './smoke.js';

let server: Server | undefined;
let closeIo: (() => Promise<void>) | undefined;
let clientDir: string | undefined;

afterEach(async () => {
  // Socket.IO's close ends every socket, then the HTTP server with it.
  await closeIo?.();
  closeIo = undefined;
  server = undefined;
  if (clientDir) rmSync(clientDir, { recursive: true, force: true });
  clientDir = undefined;
});

async function start(withClient: boolean, dev = false): Promise<string> {
  if (withClient) {
    clientDir = mkdtempSync(join(tmpdir(), 'sketchy-smoke-'));
    mkdirSync(join(clientDir, 'assets'));
    writeFileSync(
      join(clientDir, 'index.html'),
      '<div id="root"></div><script type="module" crossorigin src="/assets/index-abc.js"></script>',
    );
    writeFileSync(join(clientDir, 'assets', 'index-abc.js'), 'export {};');
  }
  const rooms = new InMemoryRoomStore();
  server = createServer(createApp({ packs: TEST_PACKS, clientDir, rooms, dev }));
  let onInk: ReturnType<typeof attachInkGateway>['onInk'] = () => {};
  const { io } = attachSockets(server, {
    rooms,
    onInk: (code, effect) => onInk(code, effect),
  });
  onInk = attachInkGateway(io, { rooms }).onInk;
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server!.once('listening', resolve));
  closeIo = () => io.close();
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe('scripts/smoke.ts', () => {
  it('passes every check against a server with a client build', async () => {
    const base = await start(true);
    const lines: string[] = [];
    await runSmoke(base, (line) => lines.push(line));
    expect(lines).toEqual([
      'ok   /healthz 200 {"ok":true}',
      'ok   / serves the client',
      'ok   /assets/index-abc.js is served',
      'ok   /play/ABCD falls back to the client',
      expect.stringMatching(/^ok {3}POST \/api\/rooms 201 \(room [A-Z]{4}\)$/),
      'ok   the dev word route is off',
      'ok   main namespace: a token Screen joins and gets its state',
      'ok   main namespace: a player joins, and the Screen sees them',
      'ok   /ink: the Screen says hello',
      "ok   /ink: the phone's handshake is bound by its playerKey",
      'ok   /ink: an unknown playerKey is refused',
    ]);
  });

  it('fails when the server does not serve the client', async () => {
    const base = await start(false);
    await expect(runSmoke(base, () => {})).rejects.toThrow('/ did not serve the client');
  });

  it('fails when the dev word route is on', async () => {
    const base = await start(true, true);
    await expect(runSmoke(base, () => {})).rejects.toThrow(/\/word answered 200$/);
  });
});
