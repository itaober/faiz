/**
 * Image utilities: the browser decodes, @jsquash (WASM) resizes and encodes WebP — browsers
 * cannot all encode WebP themselves.
 *
 * The codec packages are imported dynamically inside the functions that use
 * them: statically importing them here used to drag the WASM glue into every
 * bundle that merely touched this module (e.g. the records page via its side
 * panel). Codecs now download on the first actual compression.
 */

import { MAX_IMAGE_SIZE } from '@/lib/constants/image';

export {
  isSupportedImageType,
  MAX_SOURCE_IMAGE_SIZE,
  SUPPORTED_IMAGE_TYPES,
} from '@/lib/constants/image';

// Near-original masters: large enough for any screen, small enough to decode on a phone.
const MAX_DIMENSION = 4096;
const QUALITY = 90;
const BLUR_DIMENSION = 8;

export interface CompressedImage {
  blob: Blob;
  /** Pixel size of the encoded WebP, so pages can reserve its box before it loads. */
  width: number;
  height: number;
  /** Tiny WebP data URL painted (blurred by next/image) while the full image loads. */
  blur: string;
}

/**
 * Re-encode an image as WebP with its long side capped at {@link MAX_DIMENSION}. Steps quality
 * (then size) down only when the result would still exceed the stored limit.
 */
export const compressImage = async (file: File): Promise<CompressedImage> => {
  const original = await decodeToImageData(file, MAX_DIMENSION);
  const { buffer, imageData } = await recursiveCompress({
    imageData: original,
    targetSizeBytes: MAX_IMAGE_SIZE,
    maxWidthOrHeight: MAX_DIMENSION,
    quality: QUALITY,
  });

  return {
    blob: new Blob([buffer], { type: 'image/webp' }),
    width: imageData.width,
    height: imageData.height,
    blur: await encodeBlurPreview(imageData),
  };
};

// =========================================================================================
// Internal Helpers
// =========================================================================================

/**
 * Decode with the browser and draw straight at the capped size. The browser applies the EXIF
 * orientation (a WASM decoder would leave portrait phone photos lying on their side), and the
 * canvas never holds the full-resolution frame — iOS Safari refuses canvases above ~16.7MP,
 * which a 48MP photo would exceed.
 */
async function decodeToImageData(file: File, maxDimension: number): Promise<ImageData> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // HEIC decodes in Safari only; elsewhere the browser cannot read it at all.
    throw new Error(`This browser cannot read ${file.name}`);
  }

  try {
    const { width, height } = calculateDimensions(bitmap.width, bitmap.height, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is not available');
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    bitmap.close();
  }
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
  quality: number;
  attempt?: number;
}): Promise<{ buffer: ArrayBuffer; imageData: ImageData }> {
  const { imageData, targetSizeBytes, maxWidthOrHeight, quality } = args;
  const { attempt = 0 } = args;

  // 1. Calc target dimensions for this attempt
  const { width: targetW, height: targetH } = calculateDimensions(
    imageData.width,
    imageData.height,
    maxWidthOrHeight,
  );

  // 2. Resize only if necessary (WASM)
  let workingData = imageData;
  if (imageData.width !== targetW || imageData.height !== targetH) {
    const { default: resize } = await import('@jsquash/resize');
    workingData = await resize(imageData, {
      width: targetW,
      height: targetH,
    });
  }

  // 3. Encode (WASM)
  const { encode } = await import('@jsquash/webp');
  const buffer = await encode(workingData, { quality });

  // 4. Check & Retry Logic
  const result = { buffer, imageData: workingData };
  if (buffer.byteLength <= targetSizeBytes) {
    return result;
  }

  if (attempt >= 10) {
    // Safety break: return best effort even if slightly over
    console.warn('Compression limit reached, returning best effort.');
    return result;
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
      return result; // Can't shrink further
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

  // Clamp to 1px so an extreme panorama never rounds its short side to zero.
  const aspectRatio = width / height;
  if (width > height) {
    return { width: max, height: Math.max(1, Math.round(max / aspectRatio)) };
  }
  return { width: Math.max(1, Math.round(max * aspectRatio)), height: max };
}

async function encodeBlurPreview(imageData: ImageData): Promise<string> {
  const { default: resize } = await import('@jsquash/resize');
  const { encode } = await import('@jsquash/webp');
  const tiny = await resize(
    imageData,
    calculateDimensions(imageData.width, imageData.height, BLUR_DIMENSION),
  );
  const bytes = new Uint8Array(await encode(tiny));
  return `data:image/webp;base64,${btoa(String.fromCharCode(...bytes))}`;
}
