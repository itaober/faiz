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
  // Assets are resized at the Cloudflare edge (lib/image-loader.ts); Vercel's optimizer is not
  // used. Widths are the layouts' real slots — every extra width is another unique
  // transformation against the monthly allowance.
  images: {
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
    deviceSizes: [640, 1200, 1920, 2560],
    imageSizes: [64, 128, 256, 384],
    qualities: [75, 85],
  },
  // Image URLs from before the move to R2 live on in feed readers and shared links. Same layout
  // as the migration: files at the top of the old folder (the avatars) went to `site/`.
  async redirects() {
    const assets = process.env.NEXT_PUBLIC_ASSETS_URL?.replace(/\/+$/, '');
    if (!assets) {
      return [];
    }
    return [
      {
        source: '/api/image/assets/:file([^/]+)',
        destination: `${assets}/site/:file`,
        permanent: true,
      },
      { source: '/api/image/assets/:path+', destination: `${assets}/:path+`, permanent: true },
    ];
  },
};

export default nextConfig;
