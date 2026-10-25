import * as Units from './units';
import type { Unit } from './units';

/** `bytes` in the unit `pick` chooses, with one decimal: `1.5 KB`. Bytes stay whole: `512 B`. */
export function formatSize(bytes: number): string {
  const unit: Unit = Units.pick(bytes);
  if (unit === 'B') return `${bytes} B`;
  const size = unit === 'KB' ? bytes / Units.STEP : bytes / Units.STEP ** 2;
  return `${size.toFixed(1)} ${unit}`;
}

export class FileEntry {
  readonly name: string;
  readonly bytes: number;

  constructor(name: string, bytes: number) {
    this.name = name;
    this.bytes = bytes;
  }

  describe(): string {
    return `${this.name} (${formatSize(this.bytes)})`;
  }
}

export const README: FileEntry = new FileEntry('README.md', 2048);
