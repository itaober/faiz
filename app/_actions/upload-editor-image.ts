'use server';

import { revalidatePath } from 'next/cache';
import { uploadImage } from '@/lib/data/images';
import { requireAuth } from '@/lib/server/content-edit-token';
import { type ActionResult, createActionError, validationError } from '@/lib/types/action-result';
import {
  buildEditorImageStoragePath,
  type EditorImageScope,
  generateEditorImageId,
} from '@/lib/utils/editor-image';

const ALLOWED_SCOPES = ['memos', 'posts', 'pages', 'records'] as const;

interface IUploadEditorImageInput {
  imageBase64: string;
  mimeType: string;
  scope: EditorImageScope;
  entityId: string;
  token: string;
  imageId?: string;
  revalidate?: string;
}

const isAllowedScope = (scope: string): scope is EditorImageScope =>
  ALLOWED_SCOPES.includes(scope as EditorImageScope);

// `revalidate` arrives from the client, so keep it to the paths the editors
// actually ask for rather than handing arbitrary input to revalidatePath.
const REVALIDATABLE_PATHS = new Set(['/', '/posts', '/memos', '/lines', '/records']);

const isRevalidatablePath = (path: string) =>
  REVALIDATABLE_PATHS.has(path) || /^\/posts\/[^/]+$/.test(path);

export async function uploadEditorImageAction(
  input: IUploadEditorImageInput,
): Promise<ActionResult<string>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  if (!isAllowedScope(input.scope)) {
    return validationError('Invalid image scope');
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
      token,
    });

    if (input.revalidate && isRevalidatablePath(input.revalidate)) {
      revalidatePath(input.revalidate);
    }

    return { success: true, data: result.path };
  } catch (error) {
    console.error('Failed to upload editor image:', error);
    return createActionError(error, 'Failed to upload image');
  }
}
