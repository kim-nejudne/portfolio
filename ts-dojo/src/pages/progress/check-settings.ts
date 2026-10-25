// An imported file's compiler defaults pass the same TypeScript check as a Save on `/settings`
// (F10): `parseSettings` checks only their shape, and options TypeScript refuses would leave
// `/repl` without a project. They are left out of the import, with the reasons for the
// preview: the compiler defaults already here stay (the import replaces the settings, so the
// file's are swapped for them), and the rest of the file imports as usual.
import type { CompilerOptionsJson } from '@/protocol/ts-ls';
import type { ImportFile } from '@/store/import';
import { parseSettings, type Settings } from '@/store/settings';

export interface CheckedImport {
  file: ImportFile;
  /** TypeScript's reasons when the file's compiler defaults were left out. */
  refused: string[];
}

export async function checkImportedCompilerDefaults(
  file: ImportFile,
  local: Settings,
  check: (compilerOptions: CompilerOptionsJson) => Promise<string[]>,
): Promise<CheckedImport> {
  const { compilerDefaults } = parseSettings(file.settings);
  if (compilerDefaults === undefined) return { file, refused: [] };
  let errors: string[];
  try {
    errors = await check(compilerDefaults);
  } catch (error) {
    errors = [
      `TypeScript could not check them (${error instanceof Error ? error.message : String(error)})`,
    ];
  }
  if (errors.length === 0) return { file, refused: [] };
  const settings = { ...(file.settings as Record<string, unknown>) };
  if (local.compilerDefaults === undefined) delete settings['compilerDefaults'];
  else settings['compilerDefaults'] = local.compilerDefaults;
  return { file: { ...file, settings }, refused: errors };
}
