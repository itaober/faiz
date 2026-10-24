import { unstable_cache } from 'next/cache';
import sharp from 'sharp';

import { isSupportedImageType, MAX_IMAGE_SIZE } from '@/lib/constants/image';
import {
  type ContentImageScope,
  isContentImageReadPath,
  isSafeContentImagePath,
  normalizeContentImagePath,
} from '@/lib/content-editing-validation';
import {
  deleteGitHubFile,
  fetchGitHubApi,
  fetchGitHubContentsMeta,
  getGitHubContentTag,
  putGitHubFile,
} from '@/lib/data/common';

export interface ImageMeta {
  width: number;
  height: number;
  blurDataURL: string;
}

/** Same window as /api/image, so the size is never older than the bytes it describes. */
const IMAGE_REVALIDATE_SECONDS = 7 * 24 * 60 * 60;

const readImageMeta = async (path: string): Promise<ImageMeta> => {
  const res = await fetchGitHubApi(path, { next: { revalidate: IMAGE_REVALIDATE_SECONDS } });
  const image = sharp(Buffer.from(await res.arrayBuffer()));
  const { autoOrient } = await image.metadata();
  const blur = await image.autoOrient().resize(8, 8, { fit: 'inside' }).webp().toBuffer();

  return {
    width: autoOrient.width,
    height: autoOrient.height,
    blurDataURL: `data:image/webp;base64,${blur.toString('base64')}`,
  };
};

/**
 * Intrinsic size plus an 8px blurred preview, so a page can reserve the image's
 * box and paint the preview while the real file loads. Returns null on any
 * failure; the image then renders without a placeholder.
 *
 * Cached on its own because the bytes can be too large for the fetch cache. The
 * path's content tag drops it when the app rewrites that file; the revalidate
 * window covers files replaced outside the app. A failure throws past the cache,
 * so it is retried rather than kept.
 */
export async function getImageMeta(path: string): Promise<ImageMeta | null> {
  if (!isContentImageReadPath(path.split('/'))) {
    return null;
  }

  try {
    return await unstable_cache(() => readImageMeta(path), ['image-meta', path], {
      revalidate: IMAGE_REVALIDATE_SECONDS,
      tags: [getGitHubContentTag(path)],
    })();
  } catch (error) {
    console.warn(`Failed to read image meta for ${path}:`, error);
    return null;
  }
}

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
