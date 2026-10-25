// The ts-ls Worker entry (§2): the pure core behind postMessage, with the lib files fetched on
// demand from /ts/<version>/ (public/ts/6.0.3/, copied by scripts/copy-ts-libs.ts and precached
// by the service worker at F15), and the pre-bundled packages' declaration files from
// /packages/types.json (scripts/copy-packages.ts, §12 F14). Vite bundles `typescript` into this
// worker's chunk.
import ts from 'typescript';
import { PACKAGE_TYPES_URL, type PackageFile } from '@/protocol/packages';
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

async function loadPackageTypes(): Promise<PackageFile[]> {
  const response = await fetch(PACKAGE_TYPES_URL);
  if (!response.ok) {
    throw new Error(
      `fetching ${PACKAGE_TYPES_URL}: HTTP ${String(response.status)}`,
    );
  }
  return (await response.json()) as PackageFile[];
}

attachTsLs(self, createTsLsCore({ fetchLib, loadPackageTypes }));
