// Open in REPL (spec §1 Examples: "Each has Run and Open in REPL"; §12 F5: "creates a buffer
// with the snippet and focuses the editor in normal mode"). The theory block's button (F6)
// calls `openInRepl`: a new scratch buffer named after the lesson (or `scratch`) with the
// snippet as its text, made the last buffer, then `/repl`, which opens the last buffer and
// focuses the editor. Until F6 has a block, Layout publishes it as the Playwright seam
// `window.__tsDojoApp.openInRepl` (src/app/seam.ts).
import {
  allocateBufferName,
  listBuffers,
  putBuffer,
  writeLastBuffer,
} from '@/store/buffers';
import { getDb, type TsDojoDb } from '@/store/db';

export interface OpenInReplRequest {
  snippet: string;
  /** A base for the buffer name, such as the lesson slug; `scratch` when absent or unusable. */
  name?: string;
}

const BASE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** `03-narrowing.ts` → `03-narrowing`; anything a buffer name cannot hold → `scratch`. */
export function baseName(input: string | undefined): string {
  const trimmed = (input ?? '').trim().replace(/\.ts$/, '');
  return BASE.test(trimmed) ? trimmed : 'scratch';
}

/** Stores the snippet as a new buffer and makes it the last one; returns its name. */
export async function createReplBuffer(
  request: OpenInReplRequest,
  db: TsDojoDb = getDb(),
): Promise<string> {
  const existing = (await listBuffers(db)).map((row) => row.name);
  const name = allocateBufferName(existing, baseName(request.name));
  await putBuffer(name, request.snippet, db);
  await writeLastBuffer(name, db);
  return name;
}

export async function openInRepl(
  navigate: (to: string) => void,
  request: OpenInReplRequest,
): Promise<string> {
  const name = await createReplBuffer(request);
  navigate('/repl');
  return name;
}
