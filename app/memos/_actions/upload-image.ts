'use server';

import { revalidatePath } from 'next/cache';

import { uploadImage } from '@/lib/data/images';
import { type ActionResult, createActionError } from '@/lib/types/action-result';
import { getImageStoragePath } from '@/lib/utils/image';

const MEMOS_IMAGE_DIR = 'assets/memos';

const generateShortRandom = () => Math.random().toString(36).slice(2, 6);

interface IUploadImageInput {
  imageBase64: string;
  mimeType: string;
  memoId: string;
  token: string;
  skipRevalidate?: boolean;
}

export async function uploadImageAction(input: IUploadImageInput): Promise<ActionResult<string>> {
  if (!input.token?.trim()) {
    return {
      success: false,
      error: 'GitHub token is required',
      code: 'AUTH_INVALID',
      retryable: false,
    };
  }

  try {
    const filename = `${input.memoId}_${generateShortRandom()}.webp`;
    const storagePath = getImageStoragePath(filename, MEMOS_IMAGE_DIR);

    const result = await uploadImage({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      storagePath,
      token: input.token,
    });

    if (!input.skipRevalidate) {
      revalidatePath('/memos');
    }

    return { success: true, data: result.path };
  } catch (error) {
    console.error('Failed to upload image:', error);
    return createActionError(error, 'Failed to upload image');
  }
}

interface IUploadImagesResult {
  paths: string[];
  errors: string[];
}

export async function uploadImagesAction(
  images: Array<{ imageBase64: string; mimeType: string }>,
  memoId: string,
  token: string,
): Promise<ActionResult<IUploadImagesResult>> {
  const results = await Promise.all(
    images.map(img => uploadImageAction({ ...img, memoId, token, skipRevalidate: true })),
  );
  const paths: string[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.success && result.data) {
      paths.push(result.data);
    } else if (!result.success) {
      errors.push(result.error);
    }
  }

  if (paths.length > 0) {
    revalidatePath('/memos');
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: errors.join('; '),
      code: 'UNKNOWN',
      retryable: true,
    };
  }

  return { success: true, data: { paths, errors } };
}
