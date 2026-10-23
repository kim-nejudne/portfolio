import { Units, Unit } from './units';

/** `bytes` in the unit `pick` chooses, with one decimal: `1.5 KB`. Bytes stay whole: `512 B`. */
export function formatSize(bytes: number) {
  const unit: Unit = Units.pick(bytes);
  if (unit === 'B') return `${bytes} B`;
  const size = unit === 'KB' ? bytes / Units.STEP : bytes / Units.STEP ** 2;
  return `${size.toFixed(1)} ${unit}`;
}

export class FileEntry {
  constructor(
    readonly name: string,
    readonly bytes: number,
  ) {}

  describe(): string {
    return `${this.name} (${formatSize(this.bytes)})`;
  }
}

export const README = new FileEntry('README.md', 2048);
