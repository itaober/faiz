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
  experimental: {
    serverActions: {
      // Keep this at Vercel's Function payload limit (request/response body max: 4.5 MB):
      // https://vercel.com/docs/functions/limitations
      bodySizeLimit: '4.5mb',
    },
  },
};

export default nextConfig;
