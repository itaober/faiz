import { unstable_cache } from 'next/cache';

import { isAssetImageKey } from '@/lib/content-editing-validation';
import { type AssetImageMeta, readAssetImageMeta } from '@/lib/storage/r2';

export type ImageMeta = AssetImageMeta;

// Asset keys never change content (a new upload gets a new random key), so the size can be kept long.
const IMAGE_META_REVALIDATE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Intrinsic size plus an 8px blurred preview, recorded on the object at upload, so a page can
 * reserve the image's box and paint the preview while the file loads. Null for anything that is
 * not one of our asset keys, or a file without the metadata; the image then renders without a
 * placeholder. A failure throws past the cache, so it is retried rather than kept.
 */
export async function getImageMeta(key: string): Promise<ImageMeta | null> {
  if (!isAssetImageKey(key)) {
    return null;
  }

  try {
    return await unstable_cache(() => readAssetImageMeta(key), ['asset-image-meta-v1', key], {
      revalidate: IMAGE_META_REVALIDATE_SECONDS,
    })();
  } catch (error) {
    console.warn(`Failed to read image meta for ${key}:`, error);
    return null;
  }
}
