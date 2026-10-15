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
  // Vercel Hobby bills every cache MISS/STALE per (image × width) against 5K/month.
  // Cache for the 31-day max (editor uploads always get a fresh random-id path) and
  // keep only the widths our layouts pick. Uploads cap at 1920px; 2560 serves older
  // full-size post photos in the Retina lightbox.
  images: {
    minimumCacheTTL: 2678400,
    deviceSizes: [640, 1200, 1920, 2560],
    imageSizes: [64, 128, 256, 384],
  },
  experimental: {
    serverActions: {
      // Keep this at Vercel's Function payload limit (request/response body max: 4.5 MB):
      // https://vercel.com/docs/functions/limitations
      bodySizeLimit: '4.5mb',
    },
  },
};

export default nextConfig;
