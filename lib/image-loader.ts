import type { ImageLoaderProps } from 'next/image';

import { transformAssetUrl } from '@/lib/assets';

/** next/image loader: assets are resized at the Cloudflare edge; other sources pass through. */
export default function imageLoader({ src, width, quality }: ImageLoaderProps) {
  return transformAssetUrl(src, width, quality ?? 75);
}
