// A static server over dist/ that answers the way nginx will (deploy/nginx/ts-dojo.conf) over an
// emulated broadband link, for the §9 cold-load budgets in e2e/budgets.spec.ts. `vite preview`
// compresses per request at gzip's default level and sends everything `no-cache`; this server
// instead:
// - gzips js, css, html, svg, json and d.ts once at startup at level 9, as deploy.sh does for
//   `gzip_static`, and sends them to a client that accepts gzip;
// - sends nginx's types (`text/plain` for the lib files) and cache headers (immutable for
//   /assets/ and /ts/, no-cache for the rest) and the §10 CSP;
// - falls back to index.html for app routes, and 404s under /assets/ and /ts/;
// - shares one link among all connections: every response waits LATENCY_MS, then its bytes
//   leave in 16 KB chunks at no more than LINK_BITS_PER_SECOND in total.
//
// §9 says "broadband" without a number; the profile below is the one the measured budgets
// were taken with, recorded with them in docs/progress.md.
import { readdir, readFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { documentCsp } from '../../deploy/nginx-conf';
import { DIST } from './preview-server';

export const LINK_BITS_PER_SECOND = 50_000_000;
export const LATENCY_MS = 30;
const CHUNK = 16 * 1024;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.ts': 'text/plain',
};
const PRECOMPRESSED = /\.(js|css|html|svg|json|d\.ts)$/;

interface Entry {
  raw: Buffer;
  gz: Buffer | null;
  type: string;
}

async function walk(dir: string, base = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = `${base}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...(await walk(path.join(dir, entry.name), rel)));
    } else {
      out.push(rel);
    }
  }
  return out;
}

export interface LinkServer {
  readonly url: string;
  close(): Promise<void>;
}

export async function startLinkServer(dir = DIST): Promise<LinkServer> {
  const gzip9 = promisify(gzip);
  const files = new Map<string, Entry>();
  for (const rel of await walk(dir)) {
    const raw = await readFile(path.join(dir, rel));
    const gz = PRECOMPRESSED.test(rel) ? await gzip9(raw, { level: 9 }) : null;
    const type = TYPES[path.extname(rel)] ?? 'application/octet-stream';
    files.set(rel, { raw, gz, type });
  }
  const csp = documentCsp();
  const bytesPerMs = LINK_BITS_PER_SECOND / 8 / 1000;
  // The moment the shared link is free again.
  let linkFreeAt = 0;
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

  const send = async (res: ServerResponse, body: Buffer): Promise<void> => {
    await sleep(LATENCY_MS);
    for (let at = 0; at < body.length; at += CHUNK) {
      const chunk = body.subarray(at, at + CHUNK);
      const now = performance.now();
      linkFreeAt = Math.max(now, linkFreeAt) + chunk.length / bytesPerMs;
      await sleep(linkFreeAt - now);
      if (res.destroyed) return;
      res.write(chunk);
    }
    res.end();
  };

  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(
      new URL(req.url ?? '/', 'http://localhost').pathname,
    );
    let entry = files.get(pathname === '/' ? '/index.html' : pathname);
    const fixed =
      pathname.startsWith('/assets/') || pathname.startsWith('/ts/');
    if (entry === undefined && !fixed) entry = files.get('/index.html');
    res.setHeader('Content-Security-Policy', csp);
    if (entry === undefined) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader('Content-Type', entry.type);
    res.setHeader(
      'Cache-Control',
      fixed ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    const gzipOk = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    const body = gzipOk && entry.gz !== null ? entry.gz : entry.raw;
    if (body === entry.gz) res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Length', String(body.length));
    void send(res, body);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, 'localhost', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${String(port)}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
