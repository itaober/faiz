import { deleteGitHubFile, putGitHubFile } from '@/lib/data/common';
import { compressImageToWebP, isSupportedImageType, MAX_IMAGE_SIZE } from '@/lib/utils/image';

interface UploadImageInput {
  imageBase64: string;
  mimeType: string;
  storagePath: string;
  token: string;
}

interface UploadImageResult {
  path: string;
}

/**
 * Upload image to GitHub storage
 *
 * 1. Validate type and size
 * 2. Compress to WebP
 * 3. Upload to GitHub
 */
export async function uploadImage(input: UploadImageInput): Promise<UploadImageResult> {
  if (!isSupportedImageType(input.mimeType)) {
    throw new Error(
      `Unsupported image type: ${input.mimeType}. Supported: JPEG, PNG, GIF, WebP, HEIC, HEIF`,
    );
  }

  const buffer = Buffer.from(input.imageBase64, 'base64');

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image size exceeds limit (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
  }

  const webpBuffer = await compressImageToWebP(buffer);

  await putGitHubFile(
    input.storagePath,
    {
      contentBase64: webpBuffer.toString('base64'),
      message: `docs: add image ${input.storagePath}`,
    },
    input.token,
  );

  return { path: input.storagePath };
}

/** Delete images from GitHub storage (silent failure) */
export async function deleteImages(paths: string[], token: string): Promise<void> {
  if (!paths.length) return;

  const results = await Promise.allSettled(
    paths.map(path => deleteGitHubFile(path, `docs: delete image ${path}`, token)),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      console.warn(`Failed to delete image ${paths[i]}:`, result.reason);
    }
  }
}
