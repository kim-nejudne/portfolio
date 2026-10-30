// Runs one playtest scenario against the running app:
//
//   npm run dev                                   # in another terminal
//   npm run playtest -- scripts/playtest/smoke.ts
//   npm run playtest -- .playtest/F07/scenario.ts
//
// Screenshots go next to a scenario under .playtest/, else to .playtest/<scenario name>/.
// PLAYTEST_URL changes the target (default http://localhost:5173); HEADED=1 shows the browsers.
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, type Harness } from './harness.js';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: npm run playtest -- <scenario.ts>');
  process.exit(2);
}

const file = resolve(arg);
const insidePlaytest = !relative(resolve('.playtest'), file).startsWith('..');
const outDir = insidePlaytest ? dirname(file) : resolve('.playtest', basename(file, extname(file)));

const baseUrl = process.env.PLAYTEST_URL ?? 'http://localhost:5173';
try {
  const res = await fetch(`${baseUrl}/healthz`);
  if (!res.ok) throw new Error(`status ${res.status}`);
} catch (err) {
  console.error(`The app is not answering at ${baseUrl}/healthz (${(err as Error).message}).`);
  console.error('Start it with `npm run dev` first.');
  process.exit(2);
}

const scenario = (await import(pathToFileURL(file).href)) as {
  default: (h: Harness) => Promise<void>;
};

const h = await launch({ baseUrl, outDir });
let failed = false;
try {
  await scenario.default(h);
  console.log(`PASS ${arg}`);
} catch (err) {
  failed = true;
  console.error(`FAIL ${arg}: ${(err as Error).message}`);
  for (const role of h.roles.values()) {
    console.error(`  screenshot: ${await role.screenshot('failure').catch(() => 'unavailable')}`);
  }
} finally {
  const errors = Object.entries(h.consoleErrors()).filter(([, list]) => list.length > 0);
  for (const [name, list] of errors) {
    console.log(`console errors (${name}):`);
    for (const line of list) console.log(`  ${line}`);
  }
  await h.closeAll();
}
process.exit(failed ? 1 : 0);
