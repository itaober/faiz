import { networkInterfaces } from 'node:os';

import type { NextConfig } from 'next';

import { VARIANT_WIDTHS } from './lib/image-variants';

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
  // Every image is pre-generated at build time; the loader picks the variant.
  images: {
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
    deviceSizes: VARIANT_WIDTHS.filter(width => width > 384),
    imageSizes: VARIANT_WIDTHS.filter(width => width <= 384),
  },
  // Dev-only: the write path lives in the Cloudflare worker (`pnpm dev:worker`).
  // Same-origin proxying keeps the httpOnly edit cookie flowing. App-owned
  // routes win over rewrites, so only worker-owned /api paths reach it.
  // `output: 'export'` cannot be set in dev — rewrites (and the dev editing
  // flow generally) are rejected under it, so the static target is build-only.
  ...(process.env.NODE_ENV === 'development'
    ? {
        rewrites: async () => [
          { source: '/api/:path*', destination: 'http://127.0.0.1:8787/api/:path*' },
        ],
      }
    : { output: 'export' as const }),
};

export default nextConfig;
