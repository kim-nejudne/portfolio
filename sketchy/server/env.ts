// Environment parsing. `parseTrustProxy` is ported from Buzzr (buzzer/server/env.ts), plus `true`/`false`.

/**
 * `TRUST_PROXY`: Express's `trust proxy` setting, so `req.ip` (the rate-limit key) is the client's
 * address behind nginx. Unset, empty or `false`, it is off; `true` trusts every hop; a whole number is a hop count; anything else
 * passes through as an Express trust string (`loopback`, a CIDR list).
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === '' || value === 'false') return false;
  // Express would read the string "true" as an address list, so it must be the boolean.
  if (value === 'true') return true;
  return /^\d+$/.test(value) ? Number(value) : value;
}

/**
 * Dev tools (the `/api/dev` routes for `/dev/bots`) are opt-in: only `NODE_ENV=development`, which
 * `npm run dev` sets. Unset or anything else is off, so a deploy that forgets `NODE_ENV` stays
 * closed rather than serving the word.
 */
export function devToolsEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development';
}
