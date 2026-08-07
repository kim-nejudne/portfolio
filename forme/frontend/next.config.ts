import type { NextConfig } from 'next';

/**
 * FORME is self-hosted: nginx terminates TLS on the droplet and proxies to this
 * process on loopback. There is no PaaS here, so nothing in this file may depend
 * on one — no edge runtime, no platform image loader, no platform storage.
 *
 * nginx serves a different hostname to the one the app binds, so Server Actions
 * need the public host named explicitly or the origin check rejects every POST.
 * `FORME_PUBLIC_HOST` carries it in production; localhost covers development.
 */
const PUBLIC_HOSTS = [
  'localhost:3000',
  ...(process.env.FORME_PUBLIC_HOST ? [process.env.FORME_PUBLIC_HOST] : []),
];

/**
 * The monorepo root. Both of these need it and for different reasons:
 * Turbopack will not resolve `@forme/domain` through the hoisted
 * `node_modules` symlink unless its project root sits above `frontend/`, and
 * standalone output tracing would otherwise stop at `frontend/` and ship a
 * bundle missing the domain package entirely.
 */
const WORKSPACE_ROOT = new URL('..', import.meta.url).pathname;

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: WORKSPACE_ROOT,
  turbopack: {
    root: WORKSPACE_ROOT,
  },
  allowedDevOrigins: PUBLIC_HOSTS,
  experimental: {
    serverActions: {
      allowedOrigins: PUBLIC_HOSTS,
    },
  },
};

export default nextConfig;
