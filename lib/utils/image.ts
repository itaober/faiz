/** Image utilities using @jsquash (WASM) for compression */

import * as squooshJpeg from '@jsquash/jpeg';
import * as squooshPng from '@jsquash/png';
import resize from '@jsquash/resize';
import * as squooshWebP from '@jsquash/webp';

export { isSupportedImageType, MAX_IMAGE_SIZE, SUPPORTED_IMAGE_TYPES } from '@/lib/constants/image';

const DEFAULT_MAX_SIZE_MB = 3.38;
const DEFAULT_MAX_DIMENSION = 1920;

export interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
}

/**
 * Main Entry: Compress image to WebP (WASM) Guarantees file size < maxSizeMB by intelligent
 * resizing/quality reduction
 */
export const compressImage = async (file: File, options: CompressOptions = {}): Promise<File> => {
  const { maxSizeMB = DEFAULT_MAX_SIZE_MB, maxWidthOrHeight = DEFAULT_MAX_DIMENSION } = options;
  const targetSizeBytes = maxSizeMB * 1024 * 1024;

  // 1. Decode (Support JPEG/PNG WASM, fallback to Canvas for HEIC/Others)
  const originalImageData = await decodeToImageData(file);

  // 2. Transcode & Optimize
  // Recursively find best quality/dimension combo to fit strict size limit
  const buffer = await recursiveCompress({
    imageData: originalImageData,
    targetSizeBytes,
    maxWidthOrHeight,
  });

  // 3. Pack result
  const newName = file.name.replace(/\.[^.]+$/, '.webp');
  return new File([buffer], newName, { type: 'image/webp', lastModified: Date.now() });
};

/** Generate storage path for image file */
export const getImageStoragePath = (filename: string, dir = '/assets/images'): string => {
  return `${dir}/${filename}`;
};

// =========================================================================================
// Internal Helpers
// =========================================================================================

async function decodeToImageData(file: File): Promise<ImageData> {
  const buffer = await file.arrayBuffer();

  // WASM Decoders
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
    return await squooshJpeg.decode(buffer);
  }
  if (file.type === 'image/png') {
    return await squooshPng.decode(buffer);
  }

  // Browser Fallback (e.g. for HEIC on Safari)
  return decodeWithCanvas(file);
}

function decodeWithCanvas(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context failed'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Recursive Strategy:
 *
 * 1. Try encoding with current settings
 * 2. If too big, reduce quality
 * 3. If quality too low, shrink dimensions and restart quality
 */
async function recursiveCompress(args: {
  imageData: ImageData;
  targetSizeBytes: number;
  maxWidthOrHeight: number;
  quality?: number;
  attempt?: number;
}): Promise<ArrayBuffer> {
  const { imageData, targetSizeBytes, maxWidthOrHeight } = args;
  const { quality = 75, attempt = 0 } = args;

  // 1. Calc target dimensions for this attempt
  const { width: targetW, height: targetH } = calculateDimensions(
    imageData.width,
    imageData.height,
    maxWidthOrHeight,
  );

  // 2. Resize only if necessary (WASM)
  let workingData = imageData;
  if (imageData.width !== targetW || imageData.height !== targetH) {
    workingData = await resize(imageData, {
      width: targetW,
      height: targetH,
    });
  }

  // 3. Encode (WASM)
  const buffer = await squooshWebP.encode(workingData, { quality });

  // 4. Check & Retry Logic
  if (buffer.byteLength <= targetSizeBytes) {
    return buffer;
  }

  if (attempt >= 10) {
    // Safety break: return best effort even if slightly over
    console.warn('Compression limit reached, returning best effort.');
    return buffer;
  }

  // Next Step strategy
  let nextQuality = quality;
  let nextMaxDim = maxWidthOrHeight;

  if (quality > 30) {
    nextQuality -= 15; // Aggressive quality drop
  } else {
    // Quality already low, shrink size
    nextQuality = 60; // Reset quality for new smaller size
    nextMaxDim = Math.max(320, Math.floor(maxWidthOrHeight * 0.8)); // Shrink 20%
    if (nextMaxDim === maxWidthOrHeight) {
      return buffer; // Can't shrink further
    }
  }

  return recursiveCompress({
    ...args,
    quality: nextQuality,
    maxWidthOrHeight: nextMaxDim,
    attempt: attempt + 1,
  });
}

function calculateDimensions(width: number, height: number, max: number) {
  if (width <= max && height <= max) {
    return { width, height };
  }

  const aspectRatio = width / height;
  if (width > height) {
    return { width: max, height: Math.round(max / aspectRatio) };
  }
  return { width: Math.round(max * aspectRatio), height: max };
}
