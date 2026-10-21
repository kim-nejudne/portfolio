// Logs a warning. Nothing useful comes back.
export function warn(message: string): void {
  console.log(`warning: ${message}`);
}

// Stops with an error. It never returns.
export function fail(message: string) {
  throw new Error(message);
}

// The port in a setting such as '8080'. An empty setting means the default port.
export function parsePort(text: string): number {
  if (text === '') {
    warn('no port given, using 8080');
    return 8080;
  }
  const port = Number(text);
  if (Number.isInteger(port) && port > 0 && port < 65536) {
    return port;
  }
  fail(`not a port: ${text}`);
}
