import { networkInterfaces } from 'node:os';

import type { NextConfig } from 'next';

const getAllowedDevOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }

  const configuredOrigins =
    process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(',')
      .map(origin => origin.trim())
      .filter(Boolean) ?? [];

  const localAddresses = Object.values(networkInterfaces())
    .flatMap(networkInterface => networkInterface ?? [])
    .filter(address => address.family === 'IPv4')
    .map(address => address.address);

  return Array.from(new Set(['localhost', '127.0.0.1', ...localAddresses, ...configuredOrigins]));
};

const allowedDevOrigins = getAllowedDevOrigins();

const nextConfig: NextConfig = {
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  // Pin the project root: the parent dir is itself a pnpm workspace, and letting
  // Turbopack infer the root makes it watch ~6.5GB of sibling repos (OOM).
  turbopack: {
    root: __dirname,
  },
  // Dev-only: the write path lives in the Cloudflare worker (`pnpm dev:worker`).
  // Same-origin proxying keeps the httpOnly edit cookie flowing. App-owned
  // routes win over rewrites, so only worker-owned /api paths reach it.
  ...(process.env.NODE_ENV === 'development'
    ? {
        rewrites: async () => [
          { source: '/api/:path*', destination: 'http://127.0.0.1:8787/api/:path*' },
        ],
      }
    : {}),
};

export default nextConfig;
