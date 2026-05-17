'use server';

import { revalidatePath } from 'next/cache';

import { uploadImage } from '@/lib/data/images';
import { requireAuth } from '@/lib/server/content-edit-token';
import { type ActionResult, createActionError } from '@/lib/types/action-result';
import { buildEditorImageStoragePath } from '@/lib/utils/editor-image';

const generateShortRandom = () => Math.random().toString(36).slice(2, 6);

interface IUploadImageInput {
  imageBase64: string;
  mimeType: string;
  memoId: string;
  token: string;
  skipRevalidate?: boolean;
}

export async function uploadImageAction(input: IUploadImageInput): Promise<ActionResult<string>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const storagePath = buildEditorImageStoragePath({
      entityId: input.memoId,
      imageId: generateShortRandom(),
      scope: 'memos',
    });

    const result = await uploadImage({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      storagePath,
      token,
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
  const resolvedToken = await requireAuth(token);
  if (typeof resolvedToken !== 'string') {
    return resolvedToken;
  }

  const results = await Promise.all(
    images.map(img =>
      uploadImageAction({ ...img, memoId, token: resolvedToken, skipRevalidate: true }),
    ),
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
