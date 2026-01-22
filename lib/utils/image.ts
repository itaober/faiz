/** Image utilities Uses browser-image-compression for lightweight image compression */

import imageCompression from 'browser-image-compression';

export { isSupportedImageType, MAX_IMAGE_SIZE, SUPPORTED_IMAGE_TYPES } from '@/lib/constants/image';

// Target size: 4.5MB / 1.33 (base64 overhead) ≈ 3.38MB
const MAX_UPLOAD_SIZE_MB = 3.38;
const DEFAULT_MAX_DIMENSION = 1920;

export interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
}

/**
 * Compress image on client-side and convert to WebP Automatically adjusts quality to meet target
 * size
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxSizeMB = MAX_UPLOAD_SIZE_MB, maxWidthOrHeight = DEFAULT_MAX_DIMENSION } = options;

  const compressedFile = await imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: 'image/webp',
  });

  // Ensure .webp extension
  const newName = file.name.replace(/\.[^.]+$/, '.webp');
  return new File([compressedFile], newName, { type: 'image/webp' });
}

/** Generate storage path for image file */
export function getImageStoragePath(filename: string, dir = '/assets/images'): string {
  return `${dir}/${filename}`;
}
