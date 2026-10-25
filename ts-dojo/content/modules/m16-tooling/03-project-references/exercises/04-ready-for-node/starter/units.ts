export type Unit = 'B' | 'KB' | 'MB';

export namespace Units {
  export const STEP = 1024;

  /** The largest unit in which `bytes` is at least 1. */
  export function pick(bytes: number) {
    if (bytes >= STEP * STEP) return 'MB';
    if (bytes >= STEP) return 'KB';
    return 'B';
  }
}
