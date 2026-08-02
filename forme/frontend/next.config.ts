import type { NextConfig } from 'next';

/**
 * FORME is self-hosted behind nginx. Nothing here is platform-specific.
 *
 * The reverse proxy terminates TLS on a different hostname to the one the app
 * sees, so the Server Action origin allow-list has to name the public hosts.
 */
const PROXY_HOSTS = [
  'localhost:3000',
  '**.preview.emergentagent.com',
  '**.preview.emergentcf.cloud',
  '**.emergentagent.com',
  '**.emergentcf.cloud',
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: PROXY_HOSTS,
  experimental: {
    serverActions: {
      allowedOrigins: PROXY_HOSTS,
    },
  },
};

export default nextConfig;
