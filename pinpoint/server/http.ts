import { join } from 'node:path';
import express, { type Express } from 'express';
import type { Env } from './env.js';

export interface AppOptions {
  /** Built client (dist/client). When set, the app serves it, with index.html for client routes. */
  clientDir?: string;
  /** Express's `trust proxy` value (`TRUST_PROXY`). */
  trustProxy?: Env['trustProxy'];
}

export function createApp({ clientDir, trustProxy = false }: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  // An unknown API path stays a JSON 404; it never falls through to the client.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  if (clientDir) {
    app.use(express.static(clientDir, { index: false }));
    // Client routes (/play/:code, /screen/:code, /admin…) load the SPA; /api, /socket.io and
    // /tiles never fall through to it.
    app.get(/^\/(?!api\/|socket\.io\/|tiles\/).*/, (_req, res) => {
      res.sendFile(join(clientDir, 'index.html'));
    });
  }

  return app;
}
