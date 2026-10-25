export type Port = number & { readonly __brand: 'Port' };

/** True when n is a whole number from 1 to 65535. */
export function isPort(n: number): n is Port {
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

/** The port in `text`; throws a RangeError when it isn't one. */
export function parsePort(text: string): Port {
  const port = Number(text);
  if (!isPort(port)) {
    throw new RangeError(`not a port: ${text}`);
  }
  return port;
}

export function listen(port: Port): string {
  return `listening on ${port}`;
}
