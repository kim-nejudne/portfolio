// Deterministic two-letter monogram + one of six colours, derived from an item's name.
// No randomness, no storage. Same input, same output, everywhere.

const MONOGRAM_PALETTE = [
  { bg: '#E9DFC6', fg: '#1C2A3A' }, // sand
  { bg: '#D6D8CE', fg: '#1C2A3A' }, // dust
  { bg: '#C7CFC1', fg: '#1C2A3A' }, // sage
  { bg: '#D8C8B5', fg: '#1C2A3A' }, // clay
  { bg: '#C4C7D1', fg: '#1C2A3A' }, // slate
  { bg: '#DECFC0', fg: '#1C2A3A' }, // linen
] as const;

function hashString(input: string): number {
  // FNV-1a 32-bit — fast, deterministic.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export interface Monogram {
  letters: string;
  bg: string;
  fg: string;
}

/** Two-letter monogram + deterministic colour chip. */
export function monogramFor(name: string): Monogram {
  const cleaned = name.replace(/[^A-Za-z0-9\s]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  let letters: string;
  if (parts.length === 0) {
    letters = '··';
  } else if (parts.length === 1) {
    letters = (parts[0]?.slice(0, 2) ?? '·').toUpperCase();
  } else {
    letters = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  const idx = hashString(name.toLowerCase()) % MONOGRAM_PALETTE.length;
  const chip = MONOGRAM_PALETTE[idx] ?? MONOGRAM_PALETTE[0]!;
  return { letters, bg: chip.bg, fg: chip.fg };
}
