// `:export` and the Export button on `/progress` (§7 Export and import): builds the progress
// file from the store and the settings and downloads it as `ts-dojo-progress-<date>.json`.
// Resolves to the file name, which the caller shows.
import { CONTENT_VERSION } from '@/content/registry';
import { getDb } from '@/store/db';
import { buildExport, exportFileName, exportJson } from '@/store/export';
import { browserStorage, readSettings } from '@/store/settings';
import { downloadText } from './download';

export async function exportProgress(): Promise<string> {
  const file = await buildExport(
    getDb(),
    readSettings(browserStorage()),
    CONTENT_VERSION,
  );
  const name = exportFileName(new Date());
  downloadText(name, exportJson(file));
  return name;
}

export function exportedMessage(name: string): string {
  return `exported ${name}`;
}
