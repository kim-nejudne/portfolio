// A private `vite preview` over a built directory, for the F15 specs that cannot share the suite's
// server on 4173: the offline test stops its server so nothing on the network can answer, the
// update test serves a copy of the build whose sw.js it changes, and the CSP walk collects
// violation reports; all three serve the fixture build in dist-e2e/ unless given a directory, and
// the course spec serves the course in dist/. Started through Vite's API with
// `configFile: false`, so vite.config.ts (and the content plugin) never loads; the policy comes
// from deploy/nginx/ts-dojo.conf, as it does for the suite's server. Like that server, every file
// is `no-cache` with an ETag, so once the server is gone the HTTP cache cannot stand in for the
// service worker's precache.
//
// `reportCsp` adds `Content-Security-Policy-Report-Only: <§10>; report-uri /__csp` next to the
// enforced §10 header: the same policy, reported. Chrome sends a report for a violation in the
// page, in a dedicated worker and in the service worker alike, which the console Playwright sees
// does not cover (it drops the browser's own messages from workers).
import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview, type Plugin } from 'vite';
import { documentCsp } from '../../deploy/nginx-conf';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
/** The build of the course in content/ (`pnpm build`): the course spec and the §9 budgets. */
export const DIST = path.join(REPO_ROOT, 'dist');
/** The fixture course's build (`pnpm build --mode e2e`), served by the suite's server on 4173. */
export const E2E_DIST = path.join(REPO_ROOT, 'dist-e2e');

export interface CspReport {
  'document-uri'?: string;
  'blocked-uri'?: string;
  'violated-directive'?: string;
  'effective-directive'?: string;
  'source-file'?: string;
}

export interface DistServer {
  /** `http://localhost:<port>`, no trailing slash. */
  readonly url: string;
  /** Every CSP report received so far (with `reportCsp`). */
  reports(): CspReport[];
  close(): Promise<void>;
}

function cspReports(into: CspReport[]): Plugin {
  return {
    name: 'ts-dojo:csp-reports',
    configurePreviewServer(server) {
      server.middlewares.use('/__csp', (req, res) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body) as { 'csp-report'?: CspReport };
            into.push(parsed['csp-report'] ?? (parsed as CspReport));
          } catch {
            into.push({ 'blocked-uri': `unparsed report: ${body}` });
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export async function startDistServer(
  options: { dir?: string; reportCsp?: boolean } = {},
): Promise<DistServer> {
  const csp = documentCsp();
  const reports: CspReport[] = [];
  const server = await preview({
    configFile: false,
    root: REPO_ROOT,
    logLevel: 'silent',
    build: { outDir: options.dir ?? E2E_DIST },
    plugins: options.reportCsp === true ? [cspReports(reports)] : [],
    preview: {
      host: 'localhost',
      port: 0,
      headers: {
        'Content-Security-Policy': csp,
        ...(options.reportCsp === true
          ? {
              'Content-Security-Policy-Report-Only': `${csp}; report-uri /__csp`,
            }
          : {}),
      },
    },
  });
  const address = server.httpServer.address() as AddressInfo;
  return {
    url: `http://localhost:${String(address.port)}`,
    reports: () => [...reports],
    close: () => server.close(),
  };
}

/**
 * Whether the build in `dir` was made from the content tree whose §7 `contentVersion` is
 * `version`: the build inlines that hash (`virtual:ts-dojo/content-version`) into a script under
 * assets/. False for a missing build or one made before the content changed.
 */
export async function builtFrom(
  dir: string,
  version: string,
): Promise<boolean> {
  let names: string[];
  try {
    names = await readdir(path.join(dir, 'assets'));
  } catch {
    return false;
  }
  for (const name of names.filter((n) => n.endsWith('.js'))) {
    const text = await readFile(path.join(dir, 'assets', name), 'utf8');
    if (text.includes(version)) return true;
  }
  return false;
}

/** A throwaway copy of dist-e2e/ (the update test changes its sw.js); the function removes it. */
export async function copyDist(): Promise<{
  dir: string;
  remove: () => Promise<void>;
}> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ts-dojo-dist-'));
  await cp(E2E_DIST, dir, { recursive: true });
  return { dir, remove: () => rm(dir, { recursive: true, force: true }) };
}

/** A fresh, empty Chrome profile directory for launchPersistentContext. */
export async function tempProfile(): Promise<{
  dir: string;
  remove: () => Promise<void>;
}> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ts-dojo-profile-'));
  return { dir, remove: () => rm(dir, { recursive: true, force: true }) };
}
