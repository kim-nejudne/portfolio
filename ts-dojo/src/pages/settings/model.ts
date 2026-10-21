// The Settings page's pure parts (§7 settings, F10): the relative-numbers box when nothing is
// stored (the vimrc's own `set rnu` decides, as it does in the editor), the number fields'
// parsing with their ranges, and the compiler-defaults text, whose shape is checked here before
// the ts-ls worker's `checkCompilerOptions` asks TypeScript.
import { parseVimrc, SHIPPED_VIMRC } from '@/editor/vimrc';
import type { CompilerOptionsJson } from '@/protocol/ts-ls';
import {
  compilerDefaultsProblems,
  FONT_SIZE,
  isIntegerIn,
  TIMEOUT_RANGE,
  type Settings,
} from '@/store/settings';

const RELATIVE_NUMBER_NAMES = new Set(['rnu', 'relativenumber']);

/** What the editor shows: the stored choice, else the vimrc's last `rnu` line, else off. */
export function effectiveRelativeNumbers(settings: Settings): boolean {
  if (settings.relativeNumbers !== undefined) return settings.relativeNumbers;
  let value = false;
  for (const command of parseVimrc(settings.vimrc ?? SHIPPED_VIMRC).commands) {
    if (
      command.kind === 'set' &&
      RELATIVE_NUMBER_NAMES.has(command.name) &&
      typeof command.value === 'boolean'
    ) {
      value = command.value;
    }
  }
  return value;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseInteger(
  text: string,
  min: number,
  max: number,
  unit: string,
): Parsed<number> {
  const trimmed = text.trim();
  const value = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  return isIntegerIn(value, min, max)
    ? { ok: true, value }
    : {
        ok: false,
        error: `a whole number of ${unit} from ${String(min)} to ${String(max)}`,
      };
}

export function parseFontSize(text: string): Parsed<number> {
  return parseInteger(text, FONT_SIZE.min, FONT_SIZE.max, 'px');
}

export function parseTimeout(text: string): Parsed<number> {
  return parseInteger(text, TIMEOUT_RANGE.min, TIMEOUT_RANGE.max, 'ms');
}

export type ParsedCompilerDefaults =
  | { ok: true; value: CompilerOptionsJson | undefined }
  | { ok: false; errors: string[] };

/** Blank text means no defaults (the key removed); otherwise a JSON object of options. */
export function parseCompilerDefaultsText(
  text: string,
): ParsedCompilerDefaults {
  if (text.trim() === '') return { ok: true, value: undefined };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [
        `not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  const problems = compilerDefaultsProblems(value);
  return problems.length === 0
    ? { ok: true, value: value as CompilerOptionsJson }
    : { ok: false, errors: problems };
}

export function compilerDefaultsText(
  value: CompilerOptionsJson | undefined,
): string {
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}

/** The vimrc as stored: nothing for the shipped text, so the shipped default stays in force. */
export function vimrcToStore(text: string): string | undefined {
  return text === SHIPPED_VIMRC ? undefined : text;
}
