import { GLOBAL_IMAGES_MAX_BYTES } from '../shared/constants.js';

const MB = 1024 * 1024;

/**
 * `TRUST_PROXY`: off when unset, a hop count such as `1`, or any Express trust string (DECISIONS F06).
 * Behind a reverse proxy it must be set, or every client shares the proxy's IP in the rate limits.
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === '') return false;
  return /^\d+$/.test(value) ? Number(value) : value;
}

/**
 * `IMAGES_MAX_MB`: lowers the server-wide image cap for a small host (DECISIONS #12).
 * Images live in memory, so the container's memory limit must leave room for this many bytes.
 */
export function parseImagesMaxBytes(value: string | undefined): number {
  if (value === undefined || value === '') return GLOBAL_IMAGES_MAX_BYTES;
  const max = GLOBAL_IMAGES_MAX_BYTES / MB;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new Error(`IMAGES_MAX_MB must be a whole number from 1 to ${max}, got "${value}"`);
  }
  return Number(value) * MB;
}
