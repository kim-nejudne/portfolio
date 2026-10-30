// The lobby's join QR (Creating and joining a room: "scanning the lobby QR (`/play/:code`)").
// `qrcode` (already the terminal QR for `npm run lan`) builds the matrix; the Screen draws it as one
// SVG path, so nothing needs a canvas or `dangerouslySetInnerHTML`. Only the lazy Screen chunk
// imports this, so `/` and `/play` never download it.

import { create } from 'qrcode';

/** Light modules around the code, as the QR standard asks, so phones find its edges. */
export const QR_QUIET_ZONE = 4;

export interface QrPath {
  /** Modules per side, quiet zone included: the SVG's viewBox is `0 0 size size`. */
  size: number;
  /** One unit square per dark module. */
  d: string;
}

/**
 * The QR for `text` as an SVG path. Error correction M survives a glare spot on a TV and keeps a
 * join URL at version 3 (29 modules), large modules for a phone across the room.
 */
export function qrPath(text: string): QrPath {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  let d = '';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (modules.get(row, col)) d += `M${col + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { size: n + 2 * QR_QUIET_ZONE, d };
}

// SPEC-QUESTION: the spec doesn't say which host the QR names; this Screen's origin works in
// production and on the LAN address from `npm run lan` (DECISIONS 59).
/** The address a phone opens from the QR: this Screen's own origin, `/play/CODE`. */
export function joinUrl(origin: string, code: string): string {
  return `${origin}/play/${code}`;
}
