// The declarations for units.js, the file the prompt shows.
export type Unit = 'B' | 'kB' | 'MB' | 'GB';

export interface FormatOptions {
  digits?: number;
  unit?: Unit;
}

export const UNITS: readonly Unit[];
export function formatBytes(bytes: number, options?: FormatOptions): string;
export function parseBytes(text: string): number | null;
