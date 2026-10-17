// The Node side of the ts-ls core: lib files read from node_modules/typescript/lib instead of
// fetched from /ts/<version>/, for Vitest and the content lint (§2: both worker cores run in
// Node). Also the test fixtures. Typed with the Node project (tsconfig.node.json); never
// imported by the app.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { FetchLib } from '../libs';

const nodeRequire = createRequire(import.meta.url);

/** node_modules/typescript/lib, where typescript.js and every lib.*.d.ts live. */
export const TS_LIB_DIR = path.dirname(nodeRequire.resolve('typescript'));

export const nodeFetchLib: FetchLib = (fileName) =>
  readFile(path.join(TS_LIB_DIR, fileName), 'utf8');

/** A fetcher that records every name it is asked for, in order. */
export function countingFetchLib(base: FetchLib = nodeFetchLib): {
  fetchLib: FetchLib;
  fetched: string[];
} {
  const fetched: string[] = [];
  const fetchLib: FetchLib = (fileName) => {
    fetched.push(fileName);
    return base(fileName);
  };
  return { fetchLib, fetched };
}

export const FIXTURES_DIR = path.join(import.meta.dirname, '..', 'fixtures');

export function readFixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}
