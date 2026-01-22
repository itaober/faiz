/** Image utilities using native Canvas API for WebP compression */

export { isSupportedImageType, MAX_IMAGE_SIZE, SUPPORTED_IMAGE_TYPES } from '@/lib/constants/image';

// Target size: 4.5MB / 1.33 (base64 overhead) ≈ 3.38MB
const DEFAULT_MAX_SIZE_MB = 3.38;
const DEFAULT_MAX_DIMENSION = 1920;

export interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
}

// Helpers must be defined before usage in const arrow functions

const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = err => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
};

const calculateDimensions = (width: number, height: number, max: number) => {
  if (width <= max && height <= max) return { width, height };

  let newWidth = width;
  let newHeight = height;

  if (width > height) {
    if (width > max) {
      newWidth = max;
      newHeight = Math.round((height * max) / width);
    }
  } else {
    if (height > max) {
      newHeight = max;
      newWidth = Math.round((width * max) / height);
    }
  }
  return { width: newWidth, height: newHeight };
};

const toBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> => {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
};

/**
 * Compress image on client-side and convert to WebP using native Canvas API Automatically adjusts
 * quality to meet target size
 */
export const compressImage = async (file: File, options: CompressOptions = {}): Promise<File> => {
  const { maxSizeMB = DEFAULT_MAX_SIZE_MB, maxWidthOrHeight = DEFAULT_MAX_DIMENSION } = options;
  const targetSizeBytes = maxSizeMB * 1024 * 1024;

  // 1. Load image
  const img = await loadImage(file);

  // 2. Setup Canvas & Resize
  const canvas = document.createElement('canvas');
  const { width, height } = calculateDimensions(img.width, img.height, maxWidthOrHeight);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  // Draw and resize
  ctx.drawImage(img, 0, 0, width, height);

  // 3. Iterative Compression
  let quality = 0.9;
  let blob = await toBlob(canvas, quality);
  let attempt = 0;
  const maxAttempts = 10;

  while (blob && blob.size > targetSizeBytes && attempt < maxAttempts) {
    quality -= 0.1;
    // Clamp quality
    if (quality < 0.1) quality = 0.1;

    blob = await toBlob(canvas, quality);
    attempt++;
  }

  if (!blob) throw new Error('Image compression failed');

  // 4. Return new File
  const newName = file.name.replace(/\.[^.]+$/, '.webp');
  return new File([blob], newName, { type: 'image/webp', lastModified: Date.now() });
};

/** Generate storage path for image file */
export function getImageStoragePath(filename: string, dir = '/assets/images'): string {
  return `${dir}/${filename}`;
}
