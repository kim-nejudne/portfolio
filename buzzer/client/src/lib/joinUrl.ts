/**
 * The origin phones should join at, from the server's `joinOrigin` (F42). Null means the page's own
 * origin. A `joinOrigin` without a port (the server's LAN address) takes the page's port when the
 * protocols match, so the Vite dev server on :5173 still works.
 */
export function joinPageOrigin(joinOrigin: string | null, page: Location | URL): string {
  if (joinOrigin === null) return page.origin;
  const join = new URL(joinOrigin);
  if (join.port === '' && page.port !== '' && join.protocol === page.protocol) {
    join.port = page.port;
  }
  return join.origin;
}

/** Full URL of the player page, for the join QR. */
export function joinUrl(origin: string, code: string): string {
  return `${origin}/play/${code}`;
}

/**
 * The pairing link for a host phone. The token rides in the hash, so it is never sent to the
 * server or written to request logs (Creating and joining a room, step 3).
 */
export function pairUrl(origin: string, code: string, hostToken: string): string {
  return `${origin}/host/${code}#t=${hostToken}`;
}

/** The same URL without the protocol, for reading off the TV and typing on a phone. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

/** True when the page was opened at an address that only this computer can reach, so phones can't use the join QR. */
export function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || hostname.startsWith('127.');
}
