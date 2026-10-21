// §12 F15, the deploy kit, checked statically (Claude never runs deploy.sh; Kim does, and its
// curl checks prove the (droplet) criteria on the real host):
// - "`/l/<lesson>` loads directly; `/ts/6.0.3/lib.es2025.d.ts` is served precompressed as
//   `text/plain`; `/assets/*` is immutable; `index.html` and `sw.js` are `no-cache`." The conf is
//   parsed and each URI is resolved to the location nginx would pick (deploy/nginx-conf.ts).
// - "The CSP in §10 is present": every location that sends headers sends the §10 policy verbatim
//   (nginx drops inherited add_header lines in a location that has its own).
// - "`deploy/deploy.sh` ships `dist/` to `/var/www/ts-dojo`": shellcheck and `bash -n` pass, and
//   the steps §10 First deploy lists are there, in order.
// - "`deploy/README.md` exists with the §10 table and the Deploying, Rollback, Caching, DNS/TLS
//   and nginx sections": the table rows are read from docs/spec.md §10 and found verbatim.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  children,
  documentCsp,
  headers,
  HOST,
  locationFor,
  readConf,
  serverFor,
  type Directive,
} from './nginx-conf';

/** §10, verbatim. */
const SPEC_CSP =
  "default-src 'self'; script-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'";
const IMMUTABLE = 'public, max-age=31536000, immutable';

const file = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url));
const read = (path: string): string => readFileSync(file(path), 'utf8');

const conf = readConf();
const https = serverFor(conf, HOST, '443');
const http = serverFor(conf, HOST, '80');

const args = (block: Directive, name: string): string[][] =>
  children(block, name).map((d) => d.args);
const cacheControl = (uri: string): string | undefined =>
  headers(locationFor(https, uri)).get('Cache-Control');

describe('deploy/nginx/ts-dojo.conf', () => {
  test('serves /var/www/ts-dojo over TLS with the certbot certificate for dojo.kimnejudne.dev', () => {
    expect(args(https, 'root')).toEqual([['/var/www/ts-dojo']]);
    expect(args(https, 'ssl_certificate')).toEqual([
      [`/etc/letsencrypt/live/${HOST}/fullchain.pem`],
    ]);
    expect(args(https, 'ssl_certificate_key')).toEqual([
      [`/etc/letsencrypt/live/${HOST}/privkey.pem`],
    ]);
    expect(args(https, 'listen')).toContainEqual(['443', 'ssl']);
  });

  test('HTTP redirects to HTTPS and keeps the ACME challenge reachable on port 80', () => {
    expect(args(locationFor(http, '/l/x'), 'return')).toEqual([
      ['301', `https://${HOST}$request_uri`],
    ]);
    for (const server of [http, https]) {
      const acme = locationFor(server, '/.well-known/acme-challenge/token');
      expect(acme.args).toEqual(['^~', '/.well-known/acme-challenge/']);
      expect(args(acme, 'root')).toEqual([['/var/www/certbot']]);
    }
  });

  test('/l/<lesson> loads directly: unknown paths fall back to index.html, no-cache', () => {
    for (const uri of ['/l/m99-fixtures/01-fix', '/repl', '/m/m03-unions']) {
      const location = locationFor(https, uri);
      expect(location.args).toEqual(['/']);
      expect(args(location, 'try_files')).toEqual([['$uri', '/index.html']]);
      expect(cacheControl(uri)).toBe('no-cache');
    }
  });

  test('index.html and sw.js are no-cache', () => {
    for (const uri of ['/', '/index.html', '/sw.js', '/workbox-abc123.js']) {
      expect(cacheControl(uri), uri).toBe('no-cache');
    }
  });

  test('/assets/* is immutable and never falls back to the document', () => {
    const location = locationFor(https, '/assets/index-B-QesqR_.js');
    expect(location.args).toEqual(['/assets/']);
    expect(args(location, 'try_files')).toEqual([['$uri', '=404']]);
    expect(cacheControl('/assets/worker-abc.js')).toBe(IMMUTABLE);
  });

  test('/ts/6.0.3/lib.es2025.d.ts is text/plain, immutable, and precompressed files are served', () => {
    const location = locationFor(https, '/ts/6.0.3/lib.es2025.d.ts');
    expect(location.args).toEqual(['/ts/']);
    const types = children(location, 'types');
    expect(types).toHaveLength(1);
    expect(types[0]?.block).toEqual([{ name: 'text/plain', args: ['ts'] }]);
    expect(args(location, 'try_files')).toEqual([['$uri', '=404']]);
    expect(cacheControl('/ts/6.0.3/lib.es2025.d.ts')).toBe(IMMUTABLE);
    expect(args(https, 'gzip_static')).toEqual([['on']]);
  });

  test('manifest.webmanifest is application/manifest+json and no-cache', () => {
    const location = locationFor(https, '/manifest.webmanifest');
    expect(location.args).toEqual(['=', '/manifest.webmanifest']);
    expect(args(location, 'default_type')).toEqual([
      ['application/manifest+json'],
    ]);
    expect(cacheControl('/manifest.webmanifest')).toBe('no-cache');
  });

  test('the icon keeps the day cache of plinth brand assets: at the root, not content-hashed', () => {
    const location = locationFor(https, '/favicon.svg');
    expect(location.args).toEqual(['=', '/favicon.svg']);
    expect(cacheControl('/favicon.svg')).toBe('public, max-age=86400');
  });

  test('every location that sends headers sends the §10 CSP verbatim, with the security headers', () => {
    const sending = children(https, 'location').filter(
      (l) => headers(l).size > 0,
    );
    expect(sending.length).toBeGreaterThanOrEqual(5);
    for (const location of sending) {
      const sent = headers(location);
      const where = location.args.join(' ');
      expect(sent.get('Content-Security-Policy'), where).toBe(SPEC_CSP);
      expect(sent.get('Strict-Transport-Security'), where).toBe(
        'max-age=31536000',
      );
      expect(sent.get('X-Content-Type-Options'), where).toBe('nosniff');
      // `always`, so the headers go out on every status, not only 2xx/3xx.
      for (const d of children(location, 'add_header')) {
        expect(d.args.at(-1), `${where} ${d.args[0] ?? ''}`).toBe('always');
      }
    }
    expect(documentCsp(conf)).toBe(SPEC_CSP);
  });
});

describe('deploy/deploy.sh', () => {
  const script = read('./deploy.sh');
  const path = file('./deploy.sh');

  test('passes shellcheck and bash -n', () => {
    const lint = spawnSync('shellcheck', [path], { encoding: 'utf8' });
    expect(lint.error, 'shellcheck is installed').toBeUndefined();
    expect(lint.stdout + lint.stderr).toBe('');
    expect(lint.status).toBe(0);
    // -n parses without executing anything.
    const parse = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
    expect(parse.stderr).toBe('');
    expect(parse.status).toBe(0);
  });

  test('requires TS_DOJO_HOST and ships to /var/www/ts-dojo', () => {
    expect(script).toMatch(/^set -euo pipefail$/m);
    expect(script).toContain('HOST="${TS_DOJO_HOST:?');
    expect(script).toMatch(/^REMOTE="\/var\/www\/ts-dojo"$/m);
    expect(script).toContain('BACKUP="/var/backups/ts-dojo-${STAMP}.tar.gz"');
  });

  test('precompresses js, css, html, svg, json and d.ts with gzip -9', () => {
    const find = script.slice(
      script.indexOf('echo "==> Precompress"'),
      script.indexOf('-exec gzip'),
    );
    const names = [...find.matchAll(/-name '\*\.([a-z.]+)'/g)].map((m) => m[1]);
    expect(names.sort()).toEqual(['css', 'd.ts', 'html', 'js', 'json', 'svg']);
    expect(script).toContain('gzip -9 -k -f');
  });

  test('runs the §10 First deploy steps in order', () => {
    const steps = [
      'pnpm typecheck',
      'pnpm lint',
      'pnpm content:lint',
      'pnpm build',
      '${DIST}/index.html',
      'gzip -9 -k -f',
      'tar -czf ${BACKUP}',
      // assets and libs first, so the new index.html and sw.js never land before their files
      'rsync -az "${DIST}/assets" "${DIST}/ts"',
      'rsync -az --delete "${DIST}/" "${HOST}:${REMOTE}/"',
      'chown -R www-data:www-data ${REMOTE}',
      'nginx -t',
      'systemctl reload nginx',
      'curl ',
      'Rollback',
    ];
    let from = 0;
    for (const step of steps) {
      const at = script.indexOf(step, from);
      expect(at, `"${step}" after the previous step`).toBeGreaterThan(-1);
      from = at + step.length;
    }
  });

  test('checks the deployed site the way §12 F15 asks', () => {
    expect(script).toContain(`SITE="${HOST}"`);
    for (const check of [
      'https://${SITE}/',
      'http://${SITE}/',
      '/ts/6.0.3/lib.es2025.d.ts',
      'Content-Encoding',
      'text/plain',
      'immutable',
      'no-cache',
      '/sw.js',
      'Content-Security-Policy',
      // precompressed, not gzip on the fly: the .gz file's own length and a strong ETag
      'stat -c %s "${DIST}/ts/6.0.3/lib.es2025.d.ts.gz"',
      'W/*) fail',
      // the CSP compared whole against the conf's
      'deploy/nginx/ts-dojo.conf',
      '[ "$csp" = "$want" ]',
      // this build is the one served
      'cmp -s - "${DIST}/sw.js"',
    ]) {
      expect(script).toContain(check);
    }
  });
});

describe('deploy/README.md', () => {
  const readme = read('./README.md');

  test('has the §10 table, row for row as the spec writes it', () => {
    const spec = read('../docs/spec.md');
    const section = spec.slice(
      spec.indexOf('## 10. Deploy'),
      spec.indexOf('## 11.'),
    );
    const rows = section
      .split('\n')
      .filter((line) => line.startsWith('| '))
      .filter((line) => !/^\| (Item|---)/.test(line));
    expect(rows.map((r) => r.split('|')[1]?.trim())).toEqual([
      'Host path',
      'Process',
      'nginx',
      'TLS',
      'DNS',
      'Deploy',
    ]);
    for (const row of rows) expect(readme).toContain(row);
  });

  test('has the Deploying, Rollback, Caching, DNS/TLS and nginx sections', () => {
    const headings = readme
      .split('\n')
      .filter((line) => line.startsWith('## '))
      .map((line) => line.slice(3).trim());
    expect(headings).toEqual(
      expect.arrayContaining([
        'Deploying',
        'Rollback',
        'Caching',
        'DNS/TLS',
        'nginx',
      ]),
    );
  });
});
