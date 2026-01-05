// Server-side only image utilities (requires sharp)

import dayjs from 'dayjs';
import sharp from 'sharp';

export { isSupportedImageType, MAX_IMAGE_SIZE, SUPPORTED_IMAGE_TYPES } from '@/lib/constants/image';

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 80,
};

export async function compressImageToWebP(
  buffer: Buffer,
  options?: CompressOptions,
): Promise<Buffer> {
  const { maxWidth, maxHeight, quality } = { ...DEFAULT_OPTIONS, ...options };

  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    let resizeOptions: sharp.ResizeOptions | undefined;
    if (metadata.width && metadata.height) {
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        resizeOptions = {
          width: maxWidth,
          height: maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        };
      }
    }

    let pipeline = image;
    if (resizeOptions) {
      pipeline = pipeline.resize(resizeOptions);
    }

    return await pipeline.webp({ quality }).toBuffer();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('heif')) {
        throw new Error('HEIC/HEIF processing failed, ensure libheif is installed');
      }
      throw new Error(`Image processing failed: ${error.message}`);
    }
    throw new Error('Image processing failed: unknown error');
  }
}

export function generateImageFilename(prefix: string = 'image'): string {
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${timestamp}_${random}.webp`;
}

export function getImageStoragePath(filename: string, dir = '/assets/images'): string {
  return `${dir}/${filename}`;
}
