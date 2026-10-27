/** Full URL of the player page, for the join QR. */
export function joinUrl(origin: string, code: string): string {
  return `${origin}/play/${code}`;
}

/** The same URL without the protocol, for reading off the TV and typing on a phone. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

/** True when the page was opened at an address that only this computer can reach, so phones can't use the join QR. */
export function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || hostname.startsWith('127.');
}
