import type { ImageLoaderProps } from 'next/image';

const CONTENT_IMAGE_PREFIX = '/api/image/';

/**
 * Maps content images onto the width variants that
 * scripts/build-image-variants.mjs writes into the static build
 * (/images/w{width}/assets/…). Dev has no variants — the worker proxy serves
 * originals — and non-content sources (public/ icons, external URLs) pass
 * through untouched.
 */
export default function contentImageLoader({ src, width }: ImageLoaderProps) {
  if (process.env.NODE_ENV === 'development' || !src.startsWith(CONTENT_IMAGE_PREFIX)) {
    return src;
  }
  return `/images/w${width}${src.slice(CONTENT_IMAGE_PREFIX.length - 1)}`;
}
