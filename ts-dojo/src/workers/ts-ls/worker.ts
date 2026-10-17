// The ts-ls Worker entry (§2): the pure core behind postMessage, with the lib files fetched on
// demand from /ts/<version>/ (public/ts/6.0.3/, copied by scripts/copy-ts-libs.ts and precached
// by the service worker at F15). Vite bundles `typescript` into this worker's chunk.
import ts from 'typescript';
import { attachTsLs } from './adapter';
import { createTsLsCore } from './core';

export const LIB_BASE_URL = `/ts/${ts.version}/`;

async function fetchLib(fileName: string): Promise<string> {
  const response = await fetch(LIB_BASE_URL + fileName);
  if (!response.ok) {
    throw new Error(`fetching ${fileName}: HTTP ${String(response.status)}`);
  }
  return response.text();
}

attachTsLs(self, createTsLsCore({ fetchLib }));
