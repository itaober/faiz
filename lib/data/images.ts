import { isSupportedImageType, MAX_IMAGE_SIZE } from '@/lib/constants/image';
import {
  type ContentImageScope,
  isSafeContentImagePath,
  normalizeContentImagePath,
} from '@/lib/content-editing-validation';
import { deleteGitHubFile, fetchGitHubContentsMeta, putGitHubFile } from '@/lib/data/github';

interface IUploadImageInput {
  imageBase64: string;
  mimeType: string;
  storagePath: string;
  token: string;
}

interface IUploadImageResult {
  path: string;
}

/** Upload image to GitHub storage Image is already compressed to WebP on client-side */
export async function uploadImage(input: IUploadImageInput): Promise<IUploadImageResult> {
  if (!isSupportedImageType(input.mimeType)) {
    throw new Error(`Unsupported image type: ${input.mimeType}. Supported: JPEG, PNG, GIF, WebP`);
  }

  const buffer = Buffer.from(input.imageBase64, 'base64');

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image size exceeds limit (max ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
  }

  // Overwriting the same path has to keep working: a failed save is retried with
  // the same staged images, so look up the current revision when one exists.
  const existing = await fetchGitHubContentsMeta(input.storagePath, input.token);

  // Client already compressed to WebP, upload directly
  await putGitHubFile(
    input.storagePath,
    {
      contentBase64: input.imageBase64,
      message: `docs: add image ${input.storagePath}`,
      sha: existing?.sha,
    },
    input.token,
  );

  return { path: input.storagePath };
}

/** Delete images from GitHub storage (sequential, silent failure) */
export async function deleteImages(
  paths: string[],
  token: string,
  scope?: ContentImageScope,
): Promise<void> {
  if (!paths.length) {
    return;
  }

  // Sequential deletion to avoid GitHub API conflicts
  for (const path of paths) {
    const normalizedPath = normalizeContentImagePath(path);
    if (!isSafeContentImagePath(normalizedPath, scope)) {
      console.warn(`Skipping unsafe image delete path: ${path}`);
      continue;
    }

    try {
      await deleteGitHubFile(normalizedPath, `docs: delete image ${normalizedPath}`, token);
    } catch (error) {
      console.warn(`Failed to delete image ${normalizedPath}:`, error);
    }
  }
}
