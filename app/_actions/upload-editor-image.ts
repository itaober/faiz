'use server';

import { revalidatePath } from 'next/cache';

import { uploadImage } from '@/lib/data/images';
import { type ActionResult, createActionError } from '@/lib/types/action-result';
import {
  buildEditorImageStoragePath,
  type EditorImageScope,
  generateEditorImageId,
} from '@/lib/utils/editor-image';

const ALLOWED_SCOPES = new Set(['memos', 'posts', 'pages', 'records']);

interface IUploadEditorImageInput {
  imageBase64: string;
  mimeType: string;
  scope: EditorImageScope;
  entityId: string;
  token: string;
  imageId?: string;
  revalidate?: string;
}

export async function uploadEditorImageAction(
  input: IUploadEditorImageInput,
): Promise<ActionResult<string>> {
  if (!input.token?.trim()) {
    return {
      success: false,
      error: 'GitHub token is required',
      code: 'AUTH_INVALID',
      retryable: false,
    };
  }

  if (!ALLOWED_SCOPES.has(input.scope)) {
    return {
      success: false,
      error: 'Invalid image scope',
      code: 'VALIDATION',
      retryable: false,
    };
  }

  try {
    const storagePath = buildEditorImageStoragePath({
      entityId: input.entityId,
      imageId: input.imageId || generateEditorImageId(),
      scope: input.scope,
    });

    const result = await uploadImage({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      storagePath,
      token: input.token,
    });

    if (input.revalidate) {
      revalidatePath(input.revalidate);
    }

    return { success: true, data: result.path };
  } catch (error) {
    console.error('Failed to upload editor image:', error);
    return createActionError(error, 'Failed to upload image');
  }
}
