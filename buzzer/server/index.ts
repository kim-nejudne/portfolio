import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT } from '../shared/constants.js';
import { createApp } from './http.js';
import { InMemoryRoomStore, startRoomSweeper } from './roomStore.js';
import { attachSockets } from './sockets.js';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || DEFAULT_PORT;

// In development Vite serves the client; in production the compiled server sits in dist/server.
const clientDir = production ? fileURLToPath(new URL('../client', import.meta.url)) : undefined;

// TODO(F06, F07): pass the store to the HTTP and socket layers when room creation and joining land.
const rooms = new InMemoryRoomStore();
startRoomSweeper(rooms, Date.now);

const httpServer = createServer(createApp({ clientDir }));
attachSockets(httpServer);

httpServer.listen(port, () => {
  console.log(`Buzzr server listening on http://localhost:${port}`);
});
