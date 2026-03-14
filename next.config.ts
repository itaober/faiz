import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      // Keep this at Vercel's Function payload limit (request/response body max: 4.5 MB):
      // https://vercel.com/docs/functions/limitations
      bodySizeLimit: '4.5mb',
    },
  },
};

export default nextConfig;
